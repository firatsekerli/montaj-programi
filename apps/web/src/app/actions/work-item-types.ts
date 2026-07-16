"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Create/update/delete work-item types. Writes go through the user's session,
 * so RLS enforces that they only ever touch their own tenant's rows — the
 * tenant_id we set must match their membership or the insert is rejected.
 */

function parseForm(formData: FormData) {
  const capacityModel = String(formData.get("capacityModel") ?? "count");
  const base = {
    code: String(formData.get("code") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim() || null,
    capacity_model: capacityModel,
    base_capacity: null as Record<string, number> | null,
    effort: null as Record<string, number> | null,
  };
  if (capacityModel === "count") {
    base.base_capacity = {
      normal: Number(formData.get("normal") ?? 0),
      overtime: Number(formData.get("overtime") ?? 0),
    };
  } else {
    base.effort = { hoursPerUnit: Number(formData.get("hoursPerUnit") ?? 0) };
  }
  return base;
}

export async function createWorkItemType(formData: FormData) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  const values = parseForm(formData);

  const { error } = await supabase
    .from("work_item_type")
    .insert({ tenant_id: tenantId, ...values });
  if (error) throw new Error(error.message);

  revalidatePath("/work-item-types");
  redirect("/work-item-types");
}

export async function updateWorkItemType(id: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const values = parseForm(formData);

  const { error } = await supabase.from("work_item_type").update(values).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/work-item-types");
  redirect("/work-item-types");
}

export async function deleteWorkItemType(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("work_item_type").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/work-item-types");
}
