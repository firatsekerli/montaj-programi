"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function parse(formData: FormData) {
  const locationId = String(formData.get("current_location_id") ?? "").trim();
  const teamId = String(formData.get("team_id") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    kind: String(formData.get("kind") ?? "vehicle"),
    tracks_location: formData.get("tracks_location") === "on",
    current_location_id: locationId || null,
    team_id: teamId || null,
    resource_kind: String(formData.get("resource_kind") ?? "").trim() || null,
  };
}

/** Per-type carrying capacity, pulled from the `cap_<typeId>` inputs. */
function parseCarryCap(formData: FormData): Array<{ work_item_type_id: string; max_units: number }> {
  const rows: Array<{ work_item_type_id: string; max_units: number }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("cap_")) continue;
    const raw = String(value).trim();
    if (raw === "") continue;
    const max = Number(raw);
    if (!Number.isFinite(max) || max <= 0) continue;
    rows.push({ work_item_type_id: key.slice(4), max_units: Math.round(max) });
  }
  return rows;
}

/** Replace an asset's carry-capacity rows with the submitted ones. */
async function setCarryCap(supabase: Supabase, assetId: string, formData: FormData) {
  const caps = parseCarryCap(formData);
  await supabase.from("asset_capacity").delete().eq("asset_id", assetId);
  if (caps.length === 0) return;
  const { error } = await supabase
    .from("asset_capacity")
    .insert(caps.map((c) => ({ asset_id: assetId, ...c })));
  if (error) throw new Error(error.message);
}

export async function createAsset(formData: FormData) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("asset")
    .insert({ tenant_id: tenantId, ...parse(formData) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await setCarryCap(supabase, data.id, formData);
  revalidatePath("/assets");
  redirect("/assets");
}

export async function updateAsset(id: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("asset").update(parse(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  await setCarryCap(supabase, id, formData);
  revalidatePath("/assets");
  redirect("/assets");
}

export async function deleteAsset(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("asset").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/assets");
}
