"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  const baseLocation = String(formData.get("base_location_id") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    is_subcontractor: formData.get("is_subcontractor") === "on",
    preference_weight: Number(formData.get("preference_weight") ?? 100),
    base_location_id: baseLocation || null,
  };
}

interface CapabilityInput {
  id: string;
  cap: number | null;
}

function parseCapabilities(formData: FormData): CapabilityInput[] {
  return formData.getAll("capabilities").map(String).map((id) => {
    const raw = String(formData.get(`cap_${id}`) ?? "").trim();
    const cap = raw ? Number(raw) : NaN;
    return { id, cap: Number.isFinite(cap) && cap > 0 ? cap : null };
  });
}

async function setRelations(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  teamId: string,
  memberIds: string[],
  capabilities: CapabilityInput[],
) {
  await supabase.from("team_member").delete().eq("team_id", teamId);
  await supabase.from("team_capability").delete().eq("team_id", teamId);
  if (memberIds.length) {
    await supabase
      .from("team_member")
      .insert(memberIds.map((person_id) => ({ team_id: teamId, person_id })));
  }
  if (capabilities.length) {
    await supabase.from("team_capability").insert(
      capabilities.map((c) => ({
        team_id: teamId,
        work_item_type_id: c.id,
        daily_cap: c.cap,
      })),
    );
  }
}

export async function createTeam(formData: FormData) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("team")
    .insert({ tenant_id: tenantId, ...parse(formData) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await setRelations(
    supabase,
    data.id,
    formData.getAll("members").map(String),
    parseCapabilities(formData),
  );

  revalidatePath("/teams");
  redirect("/teams");
}

export async function updateTeam(id: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("team").update(parse(formData)).eq("id", id);
  if (error) throw new Error(error.message);

  await setRelations(
    supabase,
    id,
    formData.getAll("members").map(String),
    parseCapabilities(formData),
  );

  revalidatePath("/teams");
  redirect("/teams");
}

export async function deleteTeam(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("team").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/teams");
}
