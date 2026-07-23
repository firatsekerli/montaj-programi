"use server";

import { revalidatePath } from "next/cache";
import {
  kmToMinutes,
  nearestNeighborTourKm,
  schedule,
  shiftHours,
  unitCostDays,
  type Coord,
  type ScheduleOrder,
} from "@montaj/rules";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildPlanningContext, horizonWorkingDays, lineFacts, mondayOf, type PlanningContext } from "@/lib/planning";
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

  const { data: orders } = await supabase
    .from("work_order")
    .select(
      "id, code, delivery_date, production_ready_date, production_confirmed, requires_demolition, site:site_id(id, access_overhead_min), order_line(id, work_item_type_id, quantity, attributes)",
    )
    .in("status", ["backlog", "planned"]);

  const scheduleOrders: ScheduleOrder[] = [];
  for (const order of orders ?? []) {
    const site = one<{ id: string; access_overhead_min: number }>(order.site);
    if (!site) continue;
    const lines = (order.order_line ?? [])
      .map((line) => {
        const type = ctx.typeMap.get(line.work_item_type_id);
        if (!type) return null;
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
      siteId: site.id,
      accessOverheadMinutes: site.access_overhead_min ?? 0,
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
    siteCoords: ctx.siteCoords,
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

  revalidatePath("/planning");
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
      "id, units, order_line:order_line_id(work_item_type_id, attributes), work_order:order_id(requires_demolition, site:site_id(id, access_overhead_min))",
    )
    .eq("plan_id", planId)
    .eq("team_id", teamId)
    .eq("assign_date", date);
  if (!rows || rows.length === 0) return;

  const hoursPerDay = shiftHours(ctx.shift);
  const entries = rows.map((r) => {
    const line = one<{ work_item_type_id: string; attributes: Record<string, unknown> }>(r.order_line);
    const order = one<{ requires_demolition: boolean; site: unknown }>(r.work_order);
    const site = one<{ id: string; access_overhead_min: number }>(order?.site);
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
    return {
      id: r.id as string,
      work: (r.units as number) * unit,
      siteId: site?.id,
      access: site?.access_overhead_min ?? 0,
      coord: site ? ctx.siteCoords[site.id] : undefined,
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

/** Move an assignment to a new team/day, then re-balance the affected days. */
export async function moveAssignment(assignmentId: string, teamId: string, date: string) {
  const supabase = await createSupabaseServerClient();

  const { data: a } = await supabase
    .from("assignment")
    .select("id, plan_id, team_id, assign_date")
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

  revalidatePath("/planning");
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
