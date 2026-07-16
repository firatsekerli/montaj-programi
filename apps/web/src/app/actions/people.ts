"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    is_lead: formData.get("is_lead") === "on",
  };
}

export async function createPerson(formData: FormData) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("person").insert({ tenant_id: tenantId, ...parse(formData) });
  if (error) throw new Error(error.message);
  revalidatePath("/people");
  redirect("/people");
}

export async function updatePerson(id: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("person").update(parse(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/people");
  redirect("/people");
}

export async function deletePerson(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("person").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/people");
}
