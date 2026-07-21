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

/**
 * Per-type capacity rows from the `capmin_<id>` / `capmax_<id>` / `caplen_<id>`
 * inputs. A type is stored only when at least one of its values is set.
 */
function parseCapacities(
  formData: FormData,
): Array<{ work_item_type_id: string; min_units: number | null; max_units: number | null; max_size: Record<string, number> | null }> {
  const byType: Record<string, { min?: number; max?: number; len?: number }> = {};
  for (const [key, value] of formData.entries()) {
    const m = /^cap(min|max|len)_(.+)$/.exec(key);
    if (!m) continue;
    const field = m[1] as "min" | "max" | "len";
    const typeId = m[2]!;
    const raw = String(value).trim();
    if (raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) continue;
    (byType[typeId] ??= {})[field] = n;
  }
  const rows = [];
  for (const [typeId, v] of Object.entries(byType)) {
    const min_units = v.min != null ? Math.round(v.min) : null;
    const max_units = v.max != null ? Math.round(v.max) : null;
    const max_size = v.len != null && v.len > 0 ? { max_length_m: v.len } : null;
    if (min_units == null && max_units == null && max_size == null) continue;
    rows.push({ work_item_type_id: typeId, min_units, max_units, max_size });
  }
  return rows;
}

/** Replace an asset's capacity rows with the submitted ones. */
async function setCapacities(supabase: Supabase, assetId: string, formData: FormData) {
  const caps = parseCapacities(formData);
  await supabase.from("asset_capacity").delete().eq("asset_id", assetId);
  if (caps.length === 0) return;
  const { error } = await supabase
    .from("asset_capacity")
    .insert(caps.map((c) => ({ asset_id: assetId, ...c })));
  if (error) throw new Error(error.message);
}

/** Assets this one depends on: `dependencies` checkboxes + `depnote_<id>` notes. */
function parseDependencies(formData: FormData): Array<{ requires_asset_id: string; note: string | null }> {
  const rows: Array<{ requires_asset_id: string; note: string | null }> = [];
  for (const raw of formData.getAll("dependencies")) {
    const rid = String(raw);
    if (!rid) continue;
    rows.push({ requires_asset_id: rid, note: String(formData.get(`depnote_${rid}`) ?? "").trim() || null });
  }
  return rows;
}

/** Replace an asset's dependency rows with the submitted ones. */
async function setDependencies(supabase: Supabase, assetId: string, formData: FormData) {
  const deps = parseDependencies(formData).filter((d) => d.requires_asset_id !== assetId);
  await supabase.from("asset_dependency").delete().eq("asset_id", assetId);
  if (deps.length === 0) return;
  const { error } = await supabase
    .from("asset_dependency")
    .insert(deps.map((d) => ({ asset_id: assetId, ...d })));
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
  await setCapacities(supabase, data.id, formData);
  await setDependencies(supabase, data.id, formData);
  revalidatePath("/assets");
  redirect("/assets");
}

export async function updateAsset(id: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("asset").update(parse(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  await setCapacities(supabase, id, formData);
  await setDependencies(supabase, id, formData);
  revalidatePath("/assets");
  redirect("/assets");
}

export async function deleteAsset(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("asset").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/assets");
}

/**
 * Live update of a (basket/equipment) asset's current location — called on
 * change from the editor and the asset list, so ops can record where a moving
 * resource is without re-saving the whole asset.
 */
export async function updateAssetLocation(assetId: string, locationId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("asset")
    .update({ current_location_id: locationId || null })
    .eq("id", assetId);
  if (error) throw new Error(error.message);
  revalidatePath("/assets");
}
