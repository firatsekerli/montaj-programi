"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function num(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Update an existing base/depot location (name + coordinates). */
export async function updateLocation(
  id: string,
  data: { name: string; lat: string; lon: string },
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("location")
    .update({ name: data.name.trim(), lat: num(data.lat), lon: num(data.lon) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/teams");
}
