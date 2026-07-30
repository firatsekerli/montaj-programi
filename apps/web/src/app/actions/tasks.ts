"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Operator ticks a task off — mark it done. */
export async function completeTask(taskId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("task").update({ status: "done" }).eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
}

/** Undo — reopen a task the operator un-ticked. */
export async function reopenTask(taskId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("task").update({ status: "open" }).eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
}
