"use server";

import { revalidatePath } from "next/cache";
import {
  haversineKm,
  kmToMinutes,
  schedule,
  shiftHours,
  unitCostDays,
  type ScheduleOrder,
} from "@montaj/rules";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildPlanningContext, horizonWorkingDays, lineFacts, mondayOf } from "@/lib/planning";
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

  // Keep started/completed assignments; reserve their team-days.
  const { data: kept } = await supabase
    .from("assignment")
    .select("team_id, assign_date, estimated_cost, order_line_id, units")
    .eq("plan_id", planId)
    .in("status", ["in_progress", "completed"]);
  const committed = (kept ?? []).map((k) => ({
    teamId: k.team_id,
    date: k.assign_date,
    cost: Number(k.estimated_cost ?? 0),
  }));
  const keptUnits = new Map<string, number>();
  for (const k of kept ?? []) {
    if (k.order_line_id) keptUnits.set(k.order_line_id, (keptUnits.get(k.order_line_id) ?? 0) + k.units);
  }

  // Discard the previous "planned" (not-started) assignments before recomputing.
  await supabase.from("assignment").delete().eq("plan_id", planId).eq("status", "planned");

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

  const deliveryByOrder = new Map((orders ?? []).map((o) => [o.code, o.delivery_date] as const));
  const unplacedDetail = unplaced.map((uu) => ({
    orderCode: uu.orderCode,
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

/** Move an assignment to a new team/day, recomputing its capacity cost. */
export async function moveAssignment(assignmentId: string, teamId: string, date: string) {
  const supabase = await createSupabaseServerClient();

  const { data: a } = await supabase
    .from("assignment")
    .select(
      "id, units, order_line:order_line_id(work_item_type_id, attributes), work_order:order_id(requires_demolition, site:site_id(id, access_overhead_min))",
    )
    .eq("id", assignmentId)
    .single();
  if (!a) throw new Error("Atama bulunamadı.");

  const ctx = await buildPlanningContext(supabase);
  const line = one<{ work_item_type_id: string; attributes: Record<string, unknown> }>(a.order_line);
  const order = one<{ requires_demolition: boolean; site: unknown }>(a.work_order);
  const site = one<{ id: string; access_overhead_min: number }>(order?.site);
  const type = line ? ctx.typeMap.get(line.work_item_type_id) : undefined;
  const team = ctx.teams.find((t) => t.id === teamId);

  let estimatedCost: number | null = null;
  if (type && team && order) {
    const facts = {
      ...lineFacts(line?.attributes, order),
      "team.headcount": team.headcount,
      "day.overtime": ctx.shift.overtime,
    };
    const unit = unitCostDays(type, ctx.shift, ctx.rules, facts);
    // Single moved assignment: charge a base→site→base round trip from coords.
    const siteCoord = site ? ctx.siteCoords[site.id] : undefined;
    const roundTrip =
      team.baseCoord && siteCoord
        ? 2 * kmToMinutes(haversineKm(team.baseCoord, siteCoord), ctx.avgSpeedKmh)
        : 0;
    const overhead = ((roundTrip + (site?.access_overhead_min ?? 0)) / 60) / shiftHours(ctx.shift);
    estimatedCost = a.units * unit + overhead;
  }

  const { error } = await supabase
    .from("assignment")
    .update({ team_id: teamId, assign_date: date, estimated_cost: estimatedCost })
    .eq("id", assignmentId);
  if (error) throw new Error(error.message);

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
