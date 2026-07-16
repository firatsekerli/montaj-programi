"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_LEADTIME_DAYS = 49; // 7 weeks (tenant default)

interface LineInput {
  work_item_type_id: string;
  quantity: number;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function parse(formData: FormData) {
  const orderDate = String(formData.get("order_date") ?? "").trim();
  const readyRaw = String(formData.get("production_ready_date") ?? "").trim();
  return {
    code: String(formData.get("code") ?? "").trim(),
    site_id: String(formData.get("site_id") ?? "").trim(),
    order_date: orderDate,
    production_ready_date: readyRaw || (orderDate ? addDays(orderDate, DEFAULT_LEADTIME_DAYS) : null),
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

export async function createOrder(formData: FormData) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("work_order")
    .insert({ tenant_id: tenantId, ...parse(formData) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const lines = parseLines(formData);
  if (lines.length) {
    const { error: le } = await supabase
      .from("order_line")
      .insert(lines.map((l) => ({ tenant_id: tenantId, order_id: data.id, ...l })));
    if (le) throw new Error(le.message);
  }

  revalidatePath("/orders");
  redirect("/orders");
}

export async function updateOrder(id: string, formData: FormData) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("work_order").update(parse(formData)).eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("order_line").delete().eq("order_id", id);
  const lines = parseLines(formData);
  if (lines.length) {
    const { error: le } = await supabase
      .from("order_line")
      .insert(lines.map((l) => ({ tenant_id: tenantId, order_id: id, ...l })));
    if (le) throw new Error(le.message);
  }

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
