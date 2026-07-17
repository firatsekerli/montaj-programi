"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { WorkItemType } from "@montaj/rules";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { estimateInstallDays, productionDueDate } from "@/lib/planning";

interface LineInput {
  work_item_type_id: string;
  quantity: number;
}

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function parse(formData: FormData) {
  return {
    code: String(formData.get("code") ?? "").trim(),
    site_id: String(formData.get("site_id") ?? "").trim(),
    order_date: String(formData.get("order_date") ?? "").trim(),
    delivery_date: String(formData.get("delivery_date") ?? "").trim() || null,
    requires_demolition: formData.get("requires_demolition") === "on",
    production_confirmed: formData.get("production_confirmed") === "on",
    status: String(formData.get("status") ?? "backlog"),
  };
}

function parseLines(formData: FormData): LineInput[] {
  try {
    const raw = JSON.parse(String(formData.get("lines") ?? "[]")) as LineInput[];
    return raw
      .filter((l) => l.work_item_type_id && Number(l.quantity) > 0)
      .map((l) => ({ work_item_type_id: l.work_item_type_id, quantity: Number(l.quantity) }));
  } catch {
    return [];
  }
}

/**
 * Production-due date = the day production must be complete / installation must
 * start, worked backward from the delivery date using the order's estimated
 * install duration + the tenant's safety buffer. Null if no delivery date.
 */
async function computeProductionDue(
  supabase: Supabase,
  deliveryDate: string | null,
  lines: LineInput[],
): Promise<string | null> {
  if (!deliveryDate || lines.length === 0) return null;

  const [{ data: types }, { data: setting }] = await Promise.all([
    supabase
      .from("work_item_type")
      .select("id, code, capacity_model, base_capacity, effort")
      .in(
        "id",
        lines.map((l) => l.work_item_type_id),
      ),
    supabase
      .from("tenant_setting")
      .select("normal_shift_hours, overtime_shift_hours, working_days, production_buffer_days")
      .maybeSingle(),
  ]);

  const typeMap = new Map<string, WorkItemType>();
  for (const row of types ?? []) {
    typeMap.set(row.id, {
      id: row.id,
      code: row.code,
      capacityModel: row.capacity_model,
      baseCapacity: row.base_capacity ?? undefined,
      effort: row.effort ?? undefined,
    });
  }

  const engineLines = lines
    .map((l) => ({ type: typeMap.get(l.work_item_type_id), quantity: l.quantity }))
    .filter((l): l is { type: WorkItemType; quantity: number } => Boolean(l.type));
  if (engineLines.length === 0) return null;

  const shift = {
    overtime: false,
    normalShiftHours: Number(setting?.normal_shift_hours ?? 9),
    overtimeShiftHours: Number(setting?.overtime_shift_hours ?? 12),
  };
  const workingWeekdays = (setting?.working_days as number[] | null) ?? [1, 2, 3, 4, 5];
  const buffer = Number(setting?.production_buffer_days ?? 2);

  const installDays = estimateInstallDays(engineLines, shift);
  return productionDueDate(deliveryDate, installDays, buffer, workingWeekdays);
}

/** Notify operations of the production-due date (create/refresh an open task). */
async function upsertProductionTask(
  supabase: Supabase,
  tenantId: string,
  orderId: string,
  orderCode: string,
  productionDue: string | null,
) {
  await supabase
    .from("task")
    .delete()
    .eq("related_order_id", orderId)
    .eq("kind", "production_check")
    .eq("status", "open");
  if (!productionDue) return;
  await supabase.from("task").insert({
    tenant_id: tenantId,
    kind: "production_check",
    related_order_id: orderId,
    due_date: productionDue,
    assignee_role: "ops",
    status: "open",
    payload: { message: `${orderCode}: üretim ${productionDue} tarihine kadar tamamlanmalı.` },
  });
}

export async function createOrder(formData: FormData) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  const values = parse(formData);
  const lines = parseLines(formData);
  const productionDue = await computeProductionDue(supabase, values.delivery_date, lines);

  const { data, error } = await supabase
    .from("work_order")
    .insert({ tenant_id: tenantId, ...values, production_ready_date: productionDue })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (lines.length) {
    const { error: le } = await supabase
      .from("order_line")
      .insert(lines.map((l) => ({ tenant_id: tenantId, order_id: data.id, ...l })));
    if (le) throw new Error(le.message);
  }
  await upsertProductionTask(supabase, tenantId, data.id, values.code, productionDue);

  revalidatePath("/orders");
  redirect("/orders");
}

export async function updateOrder(id: string, formData: FormData) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  const values = parse(formData);
  const lines = parseLines(formData);
  const productionDue = await computeProductionDue(supabase, values.delivery_date, lines);

  const { error } = await supabase
    .from("work_order")
    .update({ ...values, production_ready_date: productionDue })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("order_line").delete().eq("order_id", id);
  if (lines.length) {
    const { error: le } = await supabase
      .from("order_line")
      .insert(lines.map((l) => ({ tenant_id: tenantId, order_id: id, ...l })));
    if (le) throw new Error(le.message);
  }
  await upsertProductionTask(supabase, tenantId, id, values.code, productionDue);

  revalidatePath("/orders");
  redirect("/orders");
}

export async function deleteOrder(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("work_order").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
}

export async function setOrderStatus(id: string, status: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("work_order").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
}
