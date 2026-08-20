"use server";

import { revalidatePath } from "next/cache";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface OrderNote {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
}

/** Add a note to an order (shown on every planning card for that order). */
export async function addOrderNote(orderId: string, body: string) {
  const text = body.trim();
  if (!text) return;
  const { tenantId, user, userName } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("order_note").insert({
    tenant_id: tenantId,
    order_id: orderId,
    body: text,
    author_id: user?.id ?? null,
    author_name: userName ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/planning");
}

/**
 * Add a note to a single CARD (assignment). The note is scoped to that card, so
 * split cards of the same order keep separate notes. order_id is resolved from
 * the assignment for the FK/denormalisation. Falls back to an order-level note
 * if the assignment_id column isn't there yet (lagging migration 0027).
 */
export async function addCardNote(assignmentId: string, body: string) {
  const text = body.trim();
  if (!text) return;
  const { tenantId, user, userName } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  const { data: a } = await supabase
    .from("assignment")
    .select("order_id")
    .eq("id", assignmentId)
    .maybeSingle();
  const orderId = a?.order_id as string | undefined;
  if (!orderId) throw new Error("Atama bulunamadı.");

  const base = {
    tenant_id: tenantId,
    order_id: orderId,
    body: text,
    author_id: user?.id ?? null,
    author_name: userName ?? null,
  };
  let { error } = await supabase.from("order_note").insert({ ...base, assignment_id: assignmentId });
  if (error) ({ error } = await supabase.from("order_note").insert(base));
  if (error) throw new Error(error.message);
  revalidatePath("/planning");
}

/** Remove a single note. */
export async function deleteOrderNote(noteId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("order_note").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
  revalidatePath("/planning");
}
