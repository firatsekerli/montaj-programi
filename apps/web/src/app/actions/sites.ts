"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    access_overhead_min: Number(formData.get("access_overhead_min") ?? 0),
  };
}

export async function createSite(formData: FormData) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("site").insert({ tenant_id: tenantId, ...parse(formData) });
  if (error) throw new Error(error.message);
  revalidatePath("/sites");
  redirect("/sites");
}

export async function updateSite(id: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("site").update(parse(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/sites");
  redirect("/sites");
}

export async function deleteSite(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("site").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/sites");
}
