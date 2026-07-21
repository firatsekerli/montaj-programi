"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { districtCenter } from "@/lib/districts";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * A site is located by its district: we store the district and derive lat/lon
 * from its center. If no district is chosen, lat/lon are left untouched (so an
 * existing site's coordinates aren't wiped by an unrelated edit).
 */
function parse(formData: FormData): Record<string, unknown> {
  const district = String(formData.get("district") ?? "").trim();
  const base: Record<string, unknown> = {
    name: String(formData.get("name") ?? "").trim(),
    access_overhead_min: Number(formData.get("access_overhead_min") ?? 0),
    district: district || null,
  };
  const center = district ? districtCenter(district) : null;
  if (center) {
    base.lat = center.lat;
    base.lon = center.lon;
  }
  return base;
}

/** Insert/update tolerant of a lagging migration (retry without `district`). */
async function writeSite(supabase: Supabase, values: Record<string, unknown>, id?: string) {
  const run = (v: Record<string, unknown>) =>
    id ? supabase.from("site").update(v).eq("id", id) : supabase.from("site").insert(v);
  let { error } = await run(values);
  if (error && "district" in values) {
    const { district: _drop, ...rest } = values;
    void _drop;
    ({ error } = await run(rest));
  }
  if (error) throw new Error(error.message);
}

export async function createSite(formData: FormData) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  await writeSite(supabase, { tenant_id: tenantId, ...parse(formData) });
  revalidatePath("/sites");
  redirect("/sites");
}

export async function updateSite(id: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  await writeSite(supabase, parse(formData), id);
  revalidatePath("/sites");
  redirect("/sites");
}

export async function deleteSite(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("site").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/sites");
}
