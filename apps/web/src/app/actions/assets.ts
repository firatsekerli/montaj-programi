"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  const locationId = String(formData.get("current_location_id") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    kind: String(formData.get("kind") ?? "vehicle"),
    tracks_location: formData.get("tracks_location") === "on",
    current_location_id: locationId || null,
  };
}

export async function createAsset(formData: FormData) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("asset").insert({ tenant_id: tenantId, ...parse(formData) });
  if (error) throw new Error(error.message);
  revalidatePath("/assets");
  redirect("/assets");
}

export async function updateAsset(id: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("asset").update(parse(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/assets");
  redirect("/assets");
}

export async function deleteAsset(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("asset").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/assets");
}
