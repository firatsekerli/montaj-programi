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

/** Remove a single note. */
export async function deleteOrderNote(noteId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("order_note").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
  revalidatePath("/planning");
}
