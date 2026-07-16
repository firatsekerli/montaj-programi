"use server";

import { revalidatePath } from "next/cache";
import { schedule, unitCostDays, shiftHours, type ScheduleItem } from "@montaj/rules";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildPlanningContext, lineFacts, weekDaysFrom } from "@/lib/planning";
import { one } from "@/lib/rel";

/** Generate (or regenerate) the plan for the week starting weekStart (ISO Mon). */
export async function generatePlan(weekStart: string) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();

  const ctx = await buildPlanningContext(supabase);

  const { data: orders } = await supabase
    .from("work_order")
    .select(
      "id, code, order_date, production_ready_date, production_confirmed, requires_demolition, site:site_id(id, access_overhead_min), order_line(id, work_item_type_id, quantity, attributes)",
    )
    .in("status", ["backlog", "planned"]);

  const items: ScheduleItem[] = [];
  const readyByLine = new Map<string, string | null>();
  for (const order of orders ?? []) {
    const site = one<{ id: string; access_overhead_min: number }>(order.site);
    if (!site) continue;
    for (const line of order.order_line ?? []) {
      const type = ctx.typeMap.get(line.work_item_type_id);
      if (!type) continue;
      readyByLine.set(line.id, order.production_ready_date);
      items.push({
        orderLineId: line.id,
        orderId: order.id,
        orderCode: order.code,
        siteId: site.id,
        accessOverheadMinutes: site.access_overhead_min ?? 0,
        type,
        quantity: line.quantity,
        facts: lineFacts(line.attributes, order),
        productionReadyDate: order.production_ready_date,
        productionConfirmed: order.production_confirmed,
        priority: Date.parse(order.order_date) || 0,
      });
    }
  }

  const weekDays = weekDaysFrom(weekStart, 5);
  const { assignments, unplaced } = schedule({
    weekDays,
    shift: ctx.shift,
    rules: ctx.rules,
    teams: ctx.teams,
    items,
  });

  const unplacedDetail = unplaced.map((u) => ({
    orderCode: u.orderCode,
    remaining: u.remaining,
    reason: u.reason,
    readyDate: readyByLine.get(u.orderLineId) ?? null,
  }));

  // Replace any existing plan for this week (assignments cascade).
  await supabase.from("plan").delete().eq("tenant_id", tenantId).eq("date_from", weekStart);
  const { data: plan, error: planErr } = await supabase
    .from("plan")
    .insert({
      tenant_id: tenantId,
      name: `Hafta ${weekStart}`,
      date_from: weekStart,
      date_to: weekDays[weekDays.length - 1],
      status: "draft",
      unplaced: unplacedDetail,
    })
    .select("id")
    .single();
  if (planErr) throw new Error(planErr.message);

  if (assignments.length) {
    const rows = assignments.map((a) => ({
      tenant_id: tenantId,
      plan_id: plan.id,
      assign_date: a.date,
      team_id: a.teamId,
      order_id: a.orderId,
      order_line_id: a.orderLineId,
      units: a.units,
      estimated_cost: a.estimatedCost,
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
      "id, units, order_id, order_line_id, order_line:order_line_id(work_item_type_id, attributes), work_order:order_id(requires_demolition, site:site_id(id, access_overhead_min))",
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
    const roundTrip = site ? (team.travelMinutesToSite[site.id] ?? 0) : 0;
    const overhead =
      ((roundTrip + (site?.access_overhead_min ?? 0)) / 60) / shiftHours(ctx.shift);
    estimatedCost = a.units * unit + overhead;
  }

  const { error } = await supabase
    .from("assignment")
    .update({ team_id: teamId, assign_date: date, estimated_cost: estimatedCost })
    .eq("id", assignmentId);
  if (error) throw new Error(error.message);

  revalidatePath("/planning");
}

export async function clearPlan(weekStart: string) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  await supabase.from("plan").delete().eq("tenant_id", tenantId).eq("date_from", weekStart);
  revalidatePath("/planning");
}
