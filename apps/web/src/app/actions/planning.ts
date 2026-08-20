"use server";

import { revalidatePath } from "next/cache";
import {
  haversineKm,
  kmToMinutes,
  nearestNeighborTourKm,
  schedule,
  shiftHours,
  unitCostDays,
  type Coord,
  type PlannedAssignment,
  type ScheduleOrder,
} from "@montaj/rules";
import { getCurrentContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { districtCenter } from "@/lib/districts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildPlanningContext,
  horizonWorkingDays,
  isWorkingDay,
  lineFacts,
  nextWorkingDay,
  subtractWorkingDays,
  type PlanningContext,
} from "@/lib/planning";
import { one } from "@/lib/rel";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Get the tenant's single plan, creating it if needed. */
async function getOrCreatePlan(supabase: Supabase, tenantId: string, from: string, to: string) {
  const { data: existing } = await supabase
    .from("plan")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  if (existing) {
    await supabase.from("plan").update({ date_from: from, date_to: to }).eq("id", existing.id);
    return existing.id as string;
  }
  const { data, error } = await supabase
    .from("plan")
    .insert({ tenant_id: tenantId, name: "Ana Plan", date_from: from, date_to: to, status: "draft" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/**
 * Rebuild the plan for all pending work across the whole horizon. Started and
 * completed assignments are kept (and their team-days reserved); only
 * not-started ("planned") assignments are recomputed. Each order is scheduled
 * once, inside its delivery window — no per-week duplication.
 */
export async function generatePlan() {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();

  const ctx = await buildPlanningContext(supabase);
  // Start the horizon at TODAY, not the Monday of the current week — installs
  // can't be scheduled into days that have already passed. Completed/manual cards
  // on earlier days are still kept (they're in `committed`), but no NEW work is
  // placed before today.
  const now = new Date();
  const planStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  const workingDays = horizonWorkingDays(planStart, ctx.calendar.workingWeekdays);
  const firstDay = workingDays[0]!;
  const lastDay = workingDays[workingDays.length - 1]!;

  const planId = await getOrCreatePlan(supabase, tenantId, firstDay, lastDay);

  // Assignments that are FIXED in place — started/completed work, plus any card
  // the planner dragged manually — are kept (their team-day reserved and their
  // units subtracted). Only the remaining auto-planned rows are recomputed.
  // Tolerant of a lagging migration: if `manual` is absent, fall back to status.
  type Row = {
    id: string;
    team_id: string;
    assign_date: string;
    estimated_cost: number | null;
    order_line_id: string | null;
    units: number;
    status: string;
    manual?: boolean;
  };
  let rows: Row[] = [];
  const withManual = await supabase
    .from("assignment")
    .select("id, team_id, assign_date, estimated_cost, order_line_id, units, status, manual")
    .eq("plan_id", planId);
  if (withManual.error) {
    const res = await supabase
      .from("assignment")
      .select("id, team_id, assign_date, estimated_cost, order_line_id, units, status")
      .eq("plan_id", planId);
    rows = ((res.data ?? []) as Row[]).map((r) => ({ ...r, manual: false }));
  } else {
    rows = (withManual.data ?? []) as Row[];
  }

  // Cards carrying a per-card note are preserved across a re-plan (like manual
  // ones), so a card-scoped note is never orphaned. Tolerant of a lagging 0027.
  const notedIds = new Set<string>();
  {
    const noteRes = await supabase.from("order_note").select("assignment_id").not("assignment_id", "is", null);
    for (const n of (noteRes.data ?? []) as Array<{ assignment_id: string | null }>) {
      if (n.assignment_id) notedIds.add(n.assignment_id);
    }
  }

  const fixed = rows.filter(
    (r) =>
      r.status === "in_progress" ||
      r.status === "completed" ||
      r.manual === true ||
      notedIds.has(r.id),
  );
  const deleteIds = rows
    .filter((r) => r.status === "planned" && r.manual !== true && !notedIds.has(r.id))
    .map((r) => r.id);

  const committed = fixed.map((k) => ({
    teamId: k.team_id,
    date: k.assign_date,
    cost: Number(k.estimated_cost ?? 0),
  }));
  const keptUnits = new Map<string, number>();
  for (const k of fixed) {
    if (k.order_line_id) keptUnits.set(k.order_line_id, (keptUnits.get(k.order_line_id) ?? 0) + k.units);
  }

  // Discard only the previous AUTO-planned rows; kept/manual ones stay.
  if (deleteIds.length) await supabase.from("assignment").delete().in("id", deleteIds);

  // Include requires_resource (0017) when present; fall back if behind.
  type OrderRow = {
    id: string;
    code: string;
    delivery_date: string | null;
    production_ready_date: string | null;
    production_confirmed: boolean;
    requires_demolition: boolean;
    requires_resource?: boolean;
    district: string | null;
    access_overhead_min: number | null;
    order_line: Array<{ id: string; work_item_type_id: string; quantity: number; attributes: Record<string, unknown> | null }> | null;
  };
  const orderCols =
    "id, code, delivery_date, production_ready_date, production_confirmed, requires_demolition, district, access_overhead_min, order_line(id, work_item_type_id, quantity, attributes)";
  let orders = (
    await supabase.from("work_order").select(`${orderCols}, requires_resource`).in("status", ["backlog", "planned", "in_progress"])
  ).data as OrderRow[] | null;
  if (!orders) {
    orders = (await supabase.from("work_order").select(orderCols).in("status", ["backlog", "planned", "in_progress"])).data as
      | OrderRow[]
      | null;
  }

  // Each order is its own location: the scheduler "site" is the order id, and its
  // coordinates come from the order's Ankara district center.
  const siteCoords: Record<string, Coord> = {};
  for (const order of orders ?? []) {
    const c = order.district ? districtCenter(order.district) : null;
    if (c) siteCoords[order.id] = { lat: c.lat, lon: c.lon };
  }

  // Which orders already have a committed/kept chunk on the board (pinned or
  // installed), and on which team's latest committed day. Their remainder must be
  // (re)planned FIRST so it continues consecutively from that chunk instead of
  // being scattered to the end of the horizon.
  const lineToOrder = new Map<string, string>();
  for (const order of orders ?? []) {
    for (const l of order.order_line ?? []) lineToOrder.set(l.id, order.id);
  }
  const startedTeamByOrder = new Map<string, string>();
  const startedLatestDay = new Map<string, string>();
  for (const k of fixed) {
    if (!k.order_line_id) continue;
    const oid = lineToOrder.get(k.order_line_id);
    if (!oid) continue;
    const prev = startedLatestDay.get(oid);
    if (!prev || k.assign_date > prev) {
      startedLatestDay.set(oid, k.assign_date);
      startedTeamByOrder.set(oid, k.team_id);
    }
  }

  const scheduleOrders: ScheduleOrder[] = [];
  for (const order of orders ?? []) {
    // Manlift asked per order: when the order doesn't need it, strip the type's
    // required resource for this order's lines so nothing is reserved.
    const needsResource = order.requires_resource !== false;
    const lines = (order.order_line ?? [])
      .map((line) => {
        const base = ctx.typeMap.get(line.work_item_type_id);
        if (!base) return null;
        const type = !needsResource && base.requiredResource ? { ...base, requiredResource: undefined } : base;
        const remaining = line.quantity - (keptUnits.get(line.id) ?? 0);
        if (remaining <= 0) return null;
        return {
          orderLineId: line.id,
          type,
          quantity: remaining,
          facts: lineFacts(line.attributes, order),
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
    if (lines.length === 0) continue;

    // Install can't start before production is done. Use the computed
    // production-due only when it came from a delivery date; legacy orders
    // (no delivery date) or production-confirmed ones are schedulable now.
    const earliestDate =
      order.production_confirmed || !order.delivery_date
        ? firstDay
        : (order.production_ready_date ?? firstDay);
    scheduleOrders.push({
      orderId: order.id,
      orderCode: order.code,
      siteId: order.id,
      accessOverheadMinutes: order.access_overhead_min ?? 0,
      lines,
      earliestDate: earliestDate < firstDay ? firstDay : earliestDate,
      deliveryDate: order.delivery_date,
      continuesStartedWork: startedTeamByOrder.has(order.id),
      startedTeamId: startedTeamByOrder.get(order.id),
    });
  }

  const { assignments, unplaced } = schedule({
    workingDays,
    shift: ctx.shift,
    rules: ctx.rules,
    teams: ctx.teams,
    orders: scheduleOrders,
    committed,
    siteCoords,
    avgSpeedKmh: ctx.avgSpeedKmh,
    resources: ctx.resources,
    dayFillTolerance: ctx.dayFillTolerance,
  });

  // Resolve each unplaced line to its product (kapı tipi) name for the report.
  const { data: typeRows } = await supabase.from("work_item_type").select("id, name");
  const typeNameById = new Map<string, string>((typeRows ?? []).map((r) => [r.id, r.name]));
  const lineTypeName = new Map<string, string>();
  for (const order of orders ?? []) {
    for (const line of order.order_line ?? []) {
      lineTypeName.set(line.id, typeNameById.get(line.work_item_type_id) ?? "");
    }
  }

  const deliveryByOrder = new Map((orders ?? []).map((o) => [o.code, o.delivery_date] as const));
  const unplacedDetail = unplaced.map((uu) => ({
    orderCode: uu.orderCode,
    typeName: lineTypeName.get(uu.orderLineId) ?? "",
    remaining: uu.remaining,
    reason: uu.reason,
    deliveryDate: deliveryByOrder.get(uu.orderCode) ?? null,
  }));
  await supabase.from("plan").update({ unplaced: unplacedDetail }).eq("id", planId);

  if (assignments.length) {
    const rows = assignments.map((a) => ({
      tenant_id: tenantId,
      plan_id: planId,
      assign_date: a.date,
      team_id: a.teamId,
      order_id: a.orderId,
      order_line_id: a.orderLineId,
      units: a.units,
      estimated_cost: a.estimatedCost,
      asset_ids: a.assetIds,
      status: "planned",
    }));
    const { error } = await supabase.from("assignment").insert(rows);
    if (error) throw new Error(error.message);
  }

  // Operator tasks: transfer the manlift (or any pooled resource) to a site the
  // working day before it is needed there. Reconciled by dedup_key so ticks the
  // operator already made survive a regenerate.
  const siteByOrder = new Map(scheduleOrders.map((o) => [o.orderId, o.siteId] as const));
  await syncManliftTransferTasks(supabase, ctx, tenantId, assignments, siteByOrder);
  await syncShipmentTasks(supabase, ctx, tenantId, planId);
  await syncAllOrderStatuses(supabase, tenantId);
  await logAudit({ action: "plan.generate", entity: "plan", details: { placed: assignments.length } });

  revalidatePath("/planning");
  revalidatePath("/notifications");
  revalidatePath("/orders");
}

/** Derive an order's status from totals: backlog < planned < in_progress < completed. */
function deriveStatus(total: number, installed: number, hasAssignment: boolean): string {
  if (total > 0 && installed >= total) return "completed";
  if (installed > 0) return "in_progress";
  if (hasAssignment) return "planned";
  return "backlog";
}

/**
 * Keep an order's status in step with its plan and installs:
 *   no cards → Bekleyen · has cards → Planlandı · some installed → Devam ediyor ·
 *   all installed → Tamamlandı.
 * "blocked" (Engellendi) is a manual state and is never overwritten.
 */
async function syncOrderStatus(supabase: Supabase, orderId: string) {
  const { data: order } = await supabase
    .from("work_order")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status === "blocked") return;
  const [{ data: lines }, { data: asg }] = await Promise.all([
    supabase.from("order_line").select("quantity").eq("order_id", orderId),
    supabase.from("assignment").select("units, status").eq("order_id", orderId),
  ]);
  const total = (lines ?? []).reduce((s, l) => s + Number((l as { quantity: number }).quantity), 0);
  const rows = (asg ?? []) as Array<{ units: number; status: string }>;
  const installed = rows.filter((r) => r.status === "completed").reduce((s, r) => s + Number(r.units), 0);
  const next = deriveStatus(total, installed, rows.length > 0);
  if (next !== order.status) await supabase.from("work_order").update({ status: next }).eq("id", orderId);
}

/** Bulk version of syncOrderStatus for the whole tenant (used after a re-plan). */
async function syncAllOrderStatuses(supabase: Supabase, tenantId: string) {
  const [{ data: orders }, { data: lines }, { data: asg }] = await Promise.all([
    supabase.from("work_order").select("id, status").eq("tenant_id", tenantId),
    supabase.from("order_line").select("order_id, quantity"),
    supabase.from("assignment").select("order_id, units, status"),
  ]);
  const total = new Map<string, number>();
  for (const l of (lines ?? []) as Array<{ order_id: string; quantity: number }>) {
    total.set(l.order_id, (total.get(l.order_id) ?? 0) + Number(l.quantity));
  }
  const installed = new Map<string, number>();
  const hasAny = new Set<string>();
  for (const a of (asg ?? []) as Array<{ order_id: string; units: number; status: string }>) {
    hasAny.add(a.order_id);
    if (a.status === "completed") installed.set(a.order_id, (installed.get(a.order_id) ?? 0) + Number(a.units));
  }
  const byNext = new Map<string, string[]>();
  for (const o of (orders ?? []) as Array<{ id: string; status: string }>) {
    if (o.status === "blocked") continue; // manual — leave it.
    const next = deriveStatus(total.get(o.id) ?? 0, installed.get(o.id) ?? 0, hasAny.has(o.id));
    if (next !== o.status) {
      const arr = byNext.get(next) ?? [];
      arr.push(o.id);
      byNext.set(next, arr);
    }
  }
  for (const [next, ids] of byNext) {
    if (ids.length) await supabase.from("work_order").update({ status: next }).in("id", ids);
  }
}

/**
 * Recompute estimated_cost for every assignment on one team-day, exactly the way
 * the scheduler does: each line's work (units × unit) plus, once per site, that
 * site's share of the day's nearest-neighbor tour travel + access. Called after
 * a manual move so the whole day's fill stays consistent (not just the moved
 * card). The per-day total is order-independent, so it matches the scheduler.
 */
async function recomputeTeamDay(
  supabase: Supabase,
  ctx: PlanningContext,
  planId: string,
  teamId: string,
  date: string,
) {
  const team = ctx.teams.find((t) => t.id === teamId);
  if (!team) return;
  const { data: rows } = await supabase
    .from("assignment")
    .select(
      "id, units, order_id, order_line:order_line_id(work_item_type_id, attributes), work_order:order_id(requires_demolition, district, access_overhead_min)",
    )
    .eq("plan_id", planId)
    .eq("team_id", teamId)
    .eq("assign_date", date);
  if (!rows || rows.length === 0) return;

  const hoursPerDay = shiftHours(ctx.shift);
  const entries = rows.map((r) => {
    const line = one<{ work_item_type_id: string; attributes: Record<string, unknown> }>(r.order_line);
    const order = one<{ requires_demolition: boolean; district: string | null; access_overhead_min: number | null }>(
      r.work_order,
    );
    const type = line ? ctx.typeMap.get(line.work_item_type_id) : undefined;
    let unit = 0;
    if (type) {
      const facts = {
        ...lineFacts(line?.attributes, order ?? { requires_demolition: false }),
        "team.headcount": team.headcount,
        "day.overtime": ctx.shift.overtime,
      };
      const override = team.dailyCapOverride?.[type.id];
      unit = override && override > 0 ? 1 / override : unitCostDays(type, ctx.shift, ctx.rules, facts);
    }
    // The order is its own site; its coords come from the district center.
    const c = order?.district ? districtCenter(order.district) : null;
    return {
      id: r.id as string,
      work: (r.units as number) * unit,
      siteId: r.order_id as string,
      access: order?.access_overhead_min ?? 0,
      coord: c ? { lat: c.lat, lon: c.lon } : undefined,
    };
  });
  // Stable order so the "first assignment of a site" (which carries the site's
  // overhead) is deterministic across recomputes.
  entries.sort((a, b) => a.id.localeCompare(b.id));

  // Per-site overhead = its marginal travel on the day's tour + its access.
  const siteOverhead = new Map<string, number>();
  const coordsSoFar: Coord[] = [];
  let prevTourMin = 0;
  for (const sid of [...new Set(entries.map((e) => e.siteId).filter(Boolean) as string[])].sort()) {
    const first = entries.find((e) => e.siteId === sid)!;
    let deltaTravel = 0;
    if (first.coord) {
      coordsSoFar.push(first.coord);
      const tourMin = kmToMinutes(nearestNeighborTourKm(team.baseCoord, coordsSoFar), ctx.avgSpeedKmh);
      deltaTravel = Math.max(0, tourMin - prevTourMin);
      prevTourMin = tourMin;
    }
    siteOverhead.set(sid, (deltaTravel + first.access) / 60 / hoursPerDay);
  }

  const firstOfSite = new Map<string, string>();
  for (const e of entries) if (e.siteId && !firstOfSite.has(e.siteId)) firstOfSite.set(e.siteId, e.id);

  for (const e of entries) {
    const overhead = e.siteId && firstOfSite.get(e.siteId) === e.id ? (siteOverhead.get(e.siteId) ?? 0) : 0;
    await supabase.from("assignment").update({ estimated_cost: e.work + overhead }).eq("id", e.id);
  }
}

/** Format an ISO date as Turkish dd.MM.yyyy (UTC, so the day never shifts). */
function fmtTR(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

type DesiredTask = {
  dedupKey: string;
  relatedOrderId: string | null;
  dueDate: string | null;
  payload: Record<string, unknown>;
};

/**
 * Reconcile the tasks of one kind against a freshly-derived desired set, keyed
 * by dedup_key: insert new keys, refresh existing ones (without touching their
 * status, so an operator's "done" tick survives), and remove open keys that are
 * no longer needed (done ones are kept as history). Tolerant of a lagging
 * migration: if dedup_key isn't there yet, it no-ops instead of throwing.
 */
async function reconcileTasks(
  supabase: Supabase,
  tenantId: string,
  kind: string,
  desired: DesiredTask[],
) {
  const existingRes = await supabase
    .from("task")
    .select("id, dedup_key, status")
    .eq("tenant_id", tenantId)
    .eq("kind", kind);
  if (existingRes.error) return; // dedup_key column not available yet — skip.
  const existing = (existingRes.data ?? []) as Array<{
    id: string;
    dedup_key: string | null;
    status: string;
  }>;
  const byKey = new Map(existing.filter((e) => e.dedup_key).map((e) => [e.dedup_key as string, e]));
  const desiredKeys = new Set(desired.map((d) => d.dedupKey));

  for (const d of desired) {
    const ex = byKey.get(d.dedupKey);
    if (!ex) {
      await supabase.from("task").insert({
        tenant_id: tenantId,
        kind,
        related_order_id: d.relatedOrderId,
        due_date: d.dueDate,
        assignee_role: "ops",
        status: "open",
        payload: d.payload,
        dedup_key: d.dedupKey,
      });
    } else {
      // Refresh details but leave status alone — the operator may have ticked it.
      await supabase
        .from("task")
        .update({ related_order_id: d.relatedOrderId, due_date: d.dueDate, payload: d.payload })
        .eq("id", ex.id);
    }
  }
  // Drop open tasks whose key is gone; keep done ones as a record of the transfer.
  const obsolete = existing
    .filter((e) => e.dedup_key && e.status === "open" && !desiredKeys.has(e.dedup_key))
    .map((e) => e.id);
  if (obsolete.length) await supabase.from("task").delete().in("id", obsolete);
}

/**
 * Derive "transfer the manlift the day before install" operator tasks from the
 * freshly-planned assignments. A pooled resource (manlift) needed at a different
 * site than its previous install-day must be moved there; the task is due one
 * working day before that install day.
 */
async function syncManliftTransferTasks(
  supabase: Supabase,
  ctx: PlanningContext,
  tenantId: string,
  assignments: PlannedAssignment[],
  siteByOrder: Map<string, string>,
) {
  // Assets that belong to a shared resource pool (e.g. manlifts) → their kind.
  const poolKind = new Map<string, string>();
  for (const [kind, ids] of Object.entries(ctx.resources)) for (const id of ids) poolKind.set(id, kind);
  if (poolKind.size === 0) {
    await reconcileTasks(supabase, tenantId, "manlift_transfer", []);
    return;
  }

  // Distinct (asset, install-day, site) the resource is committed to.
  const byAsset = new Map<string, Array<{ date: string; siteId: string; orderId: string }>>();
  for (const a of assignments) {
    const siteId = siteByOrder.get(a.orderId);
    if (!siteId) continue;
    for (const assetId of a.assetIds ?? []) {
      if (!poolKind.has(assetId)) continue;
      const list = byAsset.get(assetId) ?? [];
      if (!list.some((x) => x.date === a.date && x.siteId === siteId)) {
        list.push({ date: a.date, siteId, orderId: a.orderId });
      }
      byAsset.set(assetId, list);
    }
  }

  const { data: assetRows } = await supabase.from("asset").select("id, name");
  const assetName = new Map<string, string>((assetRows ?? []).map((r) => [r.id as string, r.name as string]));
  // The order is the location now — label it by code + district.
  const { data: orderRows } = await supabase.from("work_order").select("id, code, district");
  const orderLabel = new Map<string, string>(
    (orderRows ?? []).map((r) => [
      r.id as string,
      `${r.code}${r.district ? ` (${r.district})` : ""}`,
    ]),
  );

  const desired: DesiredTask[] = [];
  for (const [assetId, listRaw] of byAsset) {
    // Walk the resource's install-days in order; a change of site needs a move.
    const list = [...listRaw].sort((x, y) =>
      x.date === y.date ? x.siteId.localeCompare(y.siteId) : x.date.localeCompare(y.date),
    );
    let prevSite: string | null = null;
    for (const entry of list) {
      if (entry.siteId === prevSite) continue; // stays on site — nothing to move.
      prevSite = entry.siteId;
      const transferDay = subtractWorkingDays(entry.date, 1, ctx.calendar.workingWeekdays);
      const equip = assetName.get(assetId) ?? poolKind.get(assetId) ?? "Manlift";
      const site = orderLabel.get(entry.orderId) ?? "montaj";
      const message = `${equip}, ${site} montajı için ${fmtTR(transferDay)} tarihinde ${fmtTR(entry.date)} işine transfer edilmeli.`;
      desired.push({
        dedupKey: `${assetId}:${entry.date}:${entry.siteId}`,
        relatedOrderId: entry.orderId,
        dueDate: transferDay,
        payload: { message, kind: "manlift_transfer", assetId, siteId: entry.siteId, installDate: entry.date },
      });
    }
  }

  await reconcileTasks(supabase, tenantId, "manlift_transfer", desired);
}

/**
 * For each order with planned installs, raise a shipment task for the shipping
 * (sevkiyat) crew nearest the site: "<kişi>, <plaka> ile <şantiye>'ye <kapılar>
 * <montaj tarihi> montajı için <sevk tarihi> sevk etmeli." Due one working day
 * before the order's first install day, reconciled by dedup_key so the operator's
 * ticks survive a regenerate. No shipping crews → nothing to do (tasks cleared).
 */
async function syncShipmentTasks(
  supabase: Supabase,
  ctx: PlanningContext,
  tenantId: string,
  planId: string,
) {
  if (ctx.shippingTeams.length === 0) {
    await reconcileTasks(supabase, tenantId, "shipment", []);
    return;
  }

  // All installs still to happen (exclude already-installed/completed cards).
  const { data: rows } = await supabase
    .from("assignment")
    .select(
      "assign_date, units, order_id, order_line:order_line_id(work_item_type_id), work_order:order_id(code, district)",
    )
    .eq("plan_id", planId)
    .neq("status", "completed");

  const { data: typeRows } = await supabase.from("work_item_type").select("id, name");
  const typeName = new Map<string, string>((typeRows ?? []).map((r) => [r.id as string, r.name as string]));

  // Group by order: first install day, district, and door counts per type.
  type Grp = { first: string; district: string | null; code: string; doors: Map<string, number> };
  const byOrder = new Map<string, Grp>();
  for (const r of rows ?? []) {
    const line = one<{ work_item_type_id: string }>(r.order_line);
    const order = one<{ code: string; district: string | null }>(r.work_order);
    const orderId = r.order_id as string;
    const date = r.assign_date as string;
    const g = byOrder.get(orderId) ?? { first: date, district: order?.district ?? null, code: order?.code ?? "", doors: new Map() };
    if (date < g.first) g.first = date;
    if (line) g.doors.set(line.work_item_type_id, (g.doors.get(line.work_item_type_id) ?? 0) + (r.units as number));
    byOrder.set(orderId, g);
  }

  const desired: DesiredTask[] = [];
  for (const [orderId, g] of byOrder) {
    const dc = g.district ? districtCenter(g.district) : null;
    const siteCoord = dc ? { lat: dc.lat, lon: dc.lon } : undefined;
    // Nearest shipping crew to the order's district (falls back to the first).
    const crew =
      siteCoord && ctx.shippingTeams.some((s) => s.baseCoord)
        ? [...ctx.shippingTeams]
            .filter((s) => s.baseCoord)
            .sort((a, b) => haversineKm(a.baseCoord!, siteCoord) - haversineKm(b.baseCoord!, siteCoord))[0]!
        : ctx.shippingTeams[0]!;
    const shipDay = subtractWorkingDays(g.first, 1, ctx.calendar.workingWeekdays);
    const person = crew.people[0] ?? crew.name;
    const vehicle = crew.vehicles[0] ?? "araç";
    const doorsStr = [...g.doors.entries()]
      .map(([tid, n]) => `${n}× ${typeName.get(tid) ?? ""}`.trim())
      .join(", ");
    const dest = g.district ? `${g.code} (${g.district})` : g.code;
    const message = `${person}, ${vehicle} ile ${dest} için ${doorsStr} kapılarını ${fmtTR(g.first)} montajı için ${fmtTR(shipDay)} tarihinde sevk etmeli.`;
    desired.push({
      dedupKey: `${orderId}:${g.first}`,
      relatedOrderId: orderId,
      dueDate: shipDay,
      payload: { message, kind: "shipment", crewId: crew.id, district: g.district, installDate: g.first },
    });
  }

  await reconcileTasks(supabase, tenantId, "shipment", desired);
}

/**
 * If manual moves pulled an order's earliest install date EARLIER than its
 * planned production-ready date, revise production to one working day before the
 * new install date and (re)raise an operations notification. Returns a warning
 * message when it revised, else null.
 */
async function reviseProductionForOrder(
  supabase: Supabase,
  ctx: PlanningContext,
  planId: string,
  orderId: string,
): Promise<string | null> {
  const { data: order } = await supabase
    .from("work_order")
    .select("id, tenant_id, code, order_date, delivery_date, production_ready_date")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || !order.delivery_date) return null; // only deadline-driven orders

  const { data: asg } = await supabase
    .from("assignment")
    .select("assign_date")
    .eq("plan_id", planId)
    .eq("order_id", orderId)
    .order("assign_date", { ascending: true })
    .limit(1);
  const earliest = asg?.[0]?.assign_date as string | undefined;
  if (!earliest) return null;

  // Production must be complete one working day before installation starts — but
  // never before the order was placed. Floor it at the order date.
  let requiredProd = subtractWorkingDays(earliest, 1, ctx.calendar.workingWeekdays);
  const orderDate = order.order_date as string | null;
  if (orderDate && requiredProd < orderDate) requiredProd = orderDate;
  const current = order.production_ready_date as string | null;
  if (current && requiredProd >= current) return null; // not earlier than planned

  await supabase.from("work_order").update({ production_ready_date: requiredProd }).eq("id", orderId);

  const message = `Montaj ${fmtTR(earliest)} tarihine çekildi — üretimin en geç ${fmtTR(requiredProd)} tarihine kadar tamamlanması gerekir.`;
  await supabase
    .from("task")
    .delete()
    .eq("related_order_id", orderId)
    .eq("kind", "production_check")
    .eq("status", "open");
  await supabase.from("task").insert({
    tenant_id: order.tenant_id,
    kind: "production_check",
    related_order_id: orderId,
    due_date: requiredProd,
    assignee_role: "ops",
    status: "open",
    payload: { message, revised: true },
  });

  return `${order.code}: ${message}`;
}

/** Move an assignment to a new team/day, then re-balance the affected days. */
export async function moveAssignment(
  assignmentId: string,
  teamId: string,
  date: string,
): Promise<{ warning?: string }> {
  const supabase = await createSupabaseServerClient();

  const { data: a } = await supabase
    .from("assignment")
    .select("id, plan_id, team_id, assign_date, order_id, work_order:order_id(code)")
    .eq("id", assignmentId)
    .single();
  if (!a) throw new Error("Atama bulunamadı.");
  const sourceTeam = a.team_id as string;
  const sourceDate = a.assign_date as string;
  const planId = a.plan_id as string;
  const orderCode = one<{ code: string }>(a.work_order)?.code ?? null;

  // Move + mark manual. Tolerant of a lagging migration (no `manual` column).
  const payload = { team_id: teamId, assign_date: date };
  let { error } = await supabase.from("assignment").update({ ...payload, manual: true }).eq("id", assignmentId);
  if (error) ({ error } = await supabase.from("assignment").update(payload).eq("id", assignmentId));
  if (error) throw new Error(error.message);

  // Re-cost both the day the card left and the day it landed on, so each day's
  // fill (and every card's share) is internally consistent.
  const ctx = await buildPlanningContext(supabase);
  const affected = new Set([`${sourceTeam}|${sourceDate}`, `${teamId}|${date}`]);
  for (const key of affected) {
    const [tid, d] = key.split("|");
    await recomputeTeamDay(supabase, ctx, planId, tid!, d!);
  }

  // Pull the production date earlier + notify if this manual move needs it.
  const warning = await reviseProductionForOrder(supabase, ctx, planId, a.order_id as string);
  await logAudit({
    action: "assignment.move",
    entity: "assignment",
    entityId: assignmentId,
    label: orderCode,
    details: { date },
  });

  revalidatePath("/planning");
  revalidatePath("/notifications");
  return warning ? { warning } : {};
}

/**
 * Bulk-move several cards to a target team + date: they're packed consecutively
 * from that date across working days (by their day-cost), pinned so they stay,
 * and the plan is re-flowed so the remaining non-pinned work shifts around them.
 */
export async function bulkMove(ids: string[], teamId: string, date: string) {
  if (!ids.length || !teamId || !date) return;
  const supabase = await createSupabaseServerClient();
  const ctx = await buildPlanningContext(supabase);
  const wd = ctx.calendar.workingWeekdays;

  const { data: rows } = await supabase
    .from("assignment")
    .select("id, estimated_cost, plan_id, team_id, assign_date")
    .in("id", ids);
  if (!rows || rows.length === 0) return;
  const planId = rows[0]!.plan_id as string;
  const dayBudget = 1 + ctx.dayFillTolerance;

  const affected = new Set<string>();
  for (const r of rows) affected.add(`${r.team_id}|${r.assign_date}`);

  // Pack the selected cards from the target date forward, spilling to the next
  // working day when the day is full.
  let cursor = isWorkingDay(date, wd) ? date : nextWorkingDay(date, wd);
  let used = 0;
  for (const r of rows) {
    const cost = Number(r.estimated_cost ?? 0) || 0.5;
    if (used > 1e-9 && used + cost > dayBudget) {
      cursor = nextWorkingDay(cursor, wd);
      used = 0;
    }
    const payload = { team_id: teamId, assign_date: cursor };
    let upd = await supabase.from("assignment").update({ ...payload, manual: true }).eq("id", r.id);
    if (upd.error) upd = await supabase.from("assignment").update(payload).eq("id", r.id);
    affected.add(`${teamId}|${cursor}`);
    used += cost;
  }

  for (const key of affected) {
    const [tid, d] = key.split("|");
    await recomputeTeamDay(supabase, ctx, planId, tid!, d!);
  }
  await logAudit({ action: "assignment.bulk_move", entity: "plan", details: { count: rows.length, date } });
  // Shift the remaining non-pinned work around the pinned selection.
  await generatePlan();
}

/**
 * Record how many doors were actually installed on a card — a surgical, in-place
 * split that touches ONLY this card (no full re-plan):
 *   • installed ≥ units → the card is completed as-is.
 *   • 0 < installed < units → the card becomes the completed part, and the
 *     shortfall is left as a sibling "planned" card on the same team-day (so the
 *     day's fill is unchanged and the remainder is right there to move or, on the
 *     next "Yeniden Oluştur", to auto-place). undoInstalled reverses exactly this.
 *   • installed ≤ 0 → the card is left planned, untouched.
 */
export async function recordInstalled(
  assignmentId: string,
  installed: number,
  installerIds: string[] = [],
) {
  const supabase = await createSupabaseServerClient();
  const { data: a } = await supabase
    .from("assignment")
    .select("id, tenant_id, units, team_id, assign_date, plan_id, order_id, order_line_id, asset_ids, work_order:order_id(code)")
    .eq("id", assignmentId)
    .single();
  if (!a) throw new Error("Atama bulunamadı.");
  const units = a.units as number;
  const done = Math.max(0, Math.min(Math.round(installed), units));
  const orderCode = one<{ code: string }>(a.work_order)?.code ?? null;

  if (done <= 0) {
    await supabase.from("assignment").update({ status: "planned" }).eq("id", assignmentId);
    await syncOrderStatus(supabase, a.order_id as string);
    revalidatePath("/planning");
    revalidatePath("/orders");
    return;
  }

  // Store who installed (empty = the assigned team). Tolerant of a lagging column.
  const installers = (installerIds ?? []).filter(Boolean);
  let upd = await supabase
    .from("assignment")
    .update({ units: done, status: "completed", installer_ids: installers })
    .eq("id", assignmentId);
  if (upd.error) {
    await supabase.from("assignment").update({ units: done, status: "completed" }).eq("id", assignmentId);
  }
  // Resolve installer names for the audit trail.
  let installerNames: string[] = [];
  if (installers.length) {
    const { data: ppl } = await supabase.from("person").select("id, name").in("id", installers);
    installerNames = (ppl ?? []).map((p) => p.name as string);
  }
  const ctx = await buildPlanningContext(supabase);

  // Partial install: the same job continues the NEXT working day. Pin the
  // shortfall to that day on the same team (manual, so it stays there), then
  // re-plan so the following work shifts around it.
  const partial = done < units;
  if (partial) {
    const nextDay = nextWorkingDay(a.assign_date as string, ctx.calendar.workingWeekdays);
    const remainderRow = {
      tenant_id: a.tenant_id,
      plan_id: a.plan_id,
      assign_date: nextDay,
      team_id: a.team_id,
      order_id: a.order_id,
      order_line_id: a.order_line_id,
      units: units - done,
      asset_ids: a.asset_ids ?? [],
      status: "planned",
    };
    // Pin it (manual) so the continuation stays on the next day. Tolerant of a
    // lagging `manual` column.
    let ins = await supabase.from("assignment").insert({ ...remainderRow, manual: true });
    if (ins.error) ins = await supabase.from("assignment").insert(remainderRow);
    await recomputeTeamDay(supabase, ctx, a.plan_id as string, a.team_id as string, nextDay);
  }
  // Re-cost the completed day so its fill reflects the installed count.
  await recomputeTeamDay(supabase, ctx, a.plan_id as string, a.team_id as string, a.assign_date as string);
  await syncOrderStatus(supabase, a.order_id as string);
  await logAudit({
    action: "assignment.record",
    entity: "assignment",
    entityId: assignmentId,
    label: orderCode,
    details: { installed: done, of: units, installers: installerNames },
  });
  // Shift the rest of the plan around the completed + pinned continuation cards.
  if (partial) {
    await generatePlan();
  } else {
    revalidatePath("/planning");
    revalidatePath("/orders");
  }
}

/**
 * Undo a recorded installation — the exact inverse of recordInstalled, surgical
 * and local: merge the split-off remainder back into this card and return it to
 * planned. Only this team-day is touched; the rest of the plan is left alone.
 */
export async function undoInstalled(assignmentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: a } = await supabase
    .from("assignment")
    .select("id, units, team_id, assign_date, plan_id, order_id, order_line_id, work_order:order_id(code)")
    .eq("id", assignmentId)
    .single();
  if (!a) throw new Error("Atama bulunamadı.");
  const orderCode = one<{ code: string }>(a.work_order)?.code ?? null;

  // Merge back every planned piece of the same order line on this team — the
  // split-off continuation (which record pins to the next day) plus any same-day
  // remainder — into this card, so undo restores the single original card.
  let restored = a.units as number;
  if (a.order_line_id) {
    const { data: sibs } = await supabase
      .from("assignment")
      .select("id, units")
      .eq("plan_id", a.plan_id as string)
      .eq("team_id", a.team_id as string)
      .eq("order_line_id", a.order_line_id as string)
      .eq("status", "planned")
      .neq("id", assignmentId);
    const ids = (sibs ?? []).map((s) => s.id as string);
    restored += (sibs ?? []).reduce((s, r) => s + (r.units as number), 0);
    if (ids.length) await supabase.from("assignment").delete().in("id", ids);
  }

  // Restore this card to a single planned card with the full original count.
  let { error } = await supabase
    .from("assignment")
    .update({ units: restored, status: "planned", manual: false })
    .eq("id", assignmentId);
  if (error) {
    ({ error } = await supabase
      .from("assignment")
      .update({ units: restored, status: "planned" })
      .eq("id", assignmentId));
  }
  if (error) throw new Error(error.message);

  const ctx = await buildPlanningContext(supabase);
  await recomputeTeamDay(supabase, ctx, a.plan_id as string, a.team_id as string, a.assign_date as string);
  await syncOrderStatus(supabase, a.order_id as string);
  await logAudit({ action: "assignment.undo", entity: "assignment", entityId: assignmentId, label: orderCode });
  revalidatePath("/planning");
  revalidatePath("/orders");
}

/**
 * Release a manually-pinned card back to auto-planning: clear its `manual` flag
 * so the next "Yeniden Oluştur" recomputes it. Tolerant of a lagging migration.
 */
export async function unpinAssignment(assignmentId: string) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("assignment").update({ manual: false }).eq("id", assignmentId);
  revalidatePath("/planning");
}

/** Clear not-started assignments (keeps started/completed). */
export async function clearPlan() {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  const { data: plan } = await supabase
    .from("plan")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  if (plan) {
    // Clear only the AUTO-planned cards. Keep installed/started work (status is
    // not 'planned') and any manually-pinned cards (manual = true). Tolerant of a
    // lagging migration: if `manual` is absent, fall back to clearing all planned.
    const withManual = await supabase
      .from("assignment")
      .select("id, manual")
      .eq("plan_id", plan.id)
      .eq("status", "planned");
    let deleteIds: string[];
    if (withManual.error) {
      const res = await supabase
        .from("assignment")
        .select("id")
        .eq("plan_id", plan.id)
        .eq("status", "planned");
      deleteIds = ((res.data ?? []) as Array<{ id: string }>).map((r) => r.id);
    } else {
      deleteIds = ((withManual.data ?? []) as Array<{ id: string; manual: boolean | null }>)
        .filter((r) => r.manual !== true)
        .map((r) => r.id);
    }
    // Keep cards that carry a per-card note (tolerant of a lagging 0027).
    const noteRes = await supabase.from("order_note").select("assignment_id").not("assignment_id", "is", null);
    const notedIds = new Set(
      ((noteRes.data ?? []) as Array<{ assignment_id: string | null }>)
        .map((n) => n.assignment_id)
        .filter(Boolean) as string[],
    );
    deleteIds = deleteIds.filter((id) => !notedIds.has(id));
    if (deleteIds.length) await supabase.from("assignment").delete().in("id", deleteIds);
    await supabase.from("plan").update({ unplaced: [] }).eq("id", plan.id);
  }
  await logAudit({ action: "plan.clear", entity: "plan" });
  revalidatePath("/planning");
}
