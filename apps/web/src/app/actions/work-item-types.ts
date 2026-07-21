"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Create/update/delete work-item types. Writes go through the user's session,
 * so RLS enforces that they only ever touch their own tenant's rows — the
 * tenant_id we set must match their membership or the insert is rejected.
 */

// Columns added by later migrations — dropped on error so a lagging migration
// (0011 required_resource, 0013 crew_baseline/per_person_bonus) can't make
// creating a type fail outright.
const OPTIONAL_COLS = ["required_resource", "crew_baseline", "per_person_bonus"] as const;

/** Insert/update tolerant of missing optional columns (retry without them). */
async function writeType(supabase: Supabase, values: Record<string, unknown>, id?: string) {
  const run = (v: Record<string, unknown>) =>
    id ? supabase.from("work_item_type").update(v).eq("id", id) : supabase.from("work_item_type").insert(v);
  let { error } = await run(values);
  if (error && OPTIONAL_COLS.some((k) => k in values)) {
    const rest = { ...values };
    for (const k of OPTIONAL_COLS) delete rest[k];
    ({ error } = await run(rest));
  }
  if (error) throw new Error(error.message);
}

function parseForm(formData: FormData) {
  const capacityModel = String(formData.get("capacityModel") ?? "count");
  const base = {
    code: String(formData.get("code") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim() || null,
    capacity_model: capacityModel,
    base_capacity: null as Record<string, number> | null,
    effort: null as Record<string, unknown> | null,
    required_resource: String(formData.get("requiredResource") ?? "").trim() || null,
    crew_baseline: Math.max(1, Math.round(Number(formData.get("crewBaseline") ?? 2)) || 2),
    per_person_bonus: Math.max(0, Number(formData.get("perPersonBonus") ?? 0) || 0),
  };
  if (capacityModel === "count") {
    base.base_capacity = {
      normal: Number(formData.get("normal") ?? 0),
      overtime: Number(formData.get("overtime") ?? 0),
    };
  } else {
    // Optional continuous sizing: hours = hoursPerUnit + coefficient × line.<attr>
    const attr = String(formData.get("scaleAttr") ?? "").trim();
    const coefficient = Number(formData.get("scaleCoefficient") ?? 0);
    base.effort = {
      hoursPerUnit: Number(formData.get("hoursPerUnit") ?? 0),
      ...(attr ? { perAttr: { attr: `line.${attr}`, coefficient } } : {}),
    };
  }
  return base;
}

export async function createWorkItemType(formData: FormData) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  await writeType(supabase, { tenant_id: tenantId, ...parseForm(formData) });

  revalidatePath("/work-item-types");
  redirect("/work-item-types");
}

export async function updateWorkItemType(id: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  await writeType(supabase, parseForm(formData), id);

  revalidatePath("/work-item-types");
  redirect("/work-item-types");
}

export async function deleteWorkItemType(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("work_item_type").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/work-item-types");
}
