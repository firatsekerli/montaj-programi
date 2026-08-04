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
import { districtCenter } from "@/lib/districts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildPlanningContext,
  horizonWorkingDays,
  lineFacts,
  mondayOf,
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
  const planStart = mondayOf(new Date());
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

  const fixed = rows.filter(
    (r) => r.status === "in_progress" || r.status === "completed" || r.manual === true,
  );
  const deleteIds = rows
    .filter((r) => r.status === "planned" && r.manual !== true)
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
    await supabase.from("work_order").select(`${orderCols}, requires_resource`).in("status", ["backlog", "planned"])
  ).data as OrderRow[] | null;
  if (!orders) {
    orders = (await supabase.from("work_order").select(orderCols).in("status", ["backlog", "planned"])).data as
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

  revalidatePath("/planning");
  revalidatePath("/notifications");
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
    .select("id, plan_id, team_id, assign_date, order_id")
    .eq("id", assignmentId)
    .single();
  if (!a) throw new Error("Atama bulunamadı.");
  const sourceTeam = a.team_id as string;
  const sourceDate = a.assign_date as string;
  const planId = a.plan_id as string;

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

  revalidatePath("/planning");
  revalidatePath("/notifications");
  return warning ? { warning } : {};
}

/**
 * Record how many doors were actually installed on a card. The installed count
 * becomes a completed (locked) card; the shortfall (planned − installed) returns
 * to the order's remaining and is re-planned as new cards. installed = 0 leaves
 * the card to be re-planned as-is.
 */
export async function recordInstalled(assignmentId: string, installed: number) {
  const supabase = await createSupabaseServerClient();
  const { data: a } = await supabase
    .from("assignment")
    .select("id, units, team_id, assign_date, plan_id")
    .eq("id", assignmentId)
    .single();
  if (!a) throw new Error("Atama bulunamadı.");
  const done = Math.max(0, Math.min(Math.round(installed), a.units as number));

  if (done <= 0) {
    await supabase.from("assignment").update({ status: "planned" }).eq("id", assignmentId);
  } else {
    await supabase.from("assignment").update({ units: done, status: "completed" }).eq("id", assignmentId);
    // Re-cost the day so the completed card's fill reflects the installed count.
    const ctx = await buildPlanningContext(supabase);
    await recomputeTeamDay(supabase, ctx, a.plan_id as string, a.team_id as string, a.assign_date as string);
  }
  // Re-plan: the installed part stays committed; the shortfall becomes new cards.
  await generatePlan();
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
    await supabase.from("assignment").delete().eq("plan_id", plan.id).eq("status", "planned");
    await supabase.from("plan").update({ unplaced: [] }).eq("id", plan.id);
  }
  revalidatePath("/planning");
}
