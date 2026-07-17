"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface ClauseInput {
  var: string;
  op: string;
  value: string;
}

/** Coerce a clause value string to boolean / number / string. */
function parseValue(raw: unknown): unknown {
  const t = String(raw ?? "").trim();
  if (t === "true") return true;
  if (t === "false") return false;
  const n = Number(t);
  if (t !== "" && Number.isFinite(n)) return n;
  return t;
}

function parse(formData: FormData) {
  const effectOp = String(formData.get("effect_op") ?? "multiply_capacity");
  const effectValue = Number(formData.get("effect_value") ?? 1);
  const effect =
    effectOp === "add_units"
      ? { op: "add_units", n: effectValue }
      : { op: effectOp, factor: effectValue };

  let clauses: ClauseInput[] = [];
  try {
    clauses = JSON.parse(String(formData.get("clauses") ?? "[]")) as ClauseInput[];
  } catch {
    clauses = [];
  }
  const valid = clauses.filter((c) => c.var && c.op);
  // Flat AND of simple comparisons — covers the Dimak rules and most others.
  const condition = valid.length
    ? { all: valid.map((c) => ({ var: c.var, op: c.op, value: parseValue(c.value) })) }
    : null;

  return {
    name: String(formData.get("name") ?? "").trim(),
    enabled: formData.get("enabled") === "on",
    priority: Number(formData.get("priority") ?? 100),
    scope: "global",
    condition,
    effect,
  };
}

export async function createRule(formData: FormData) {
  const { tenantId } = await getCurrentContext();
  if (!tenantId) throw new Error("Kiracı bulunamadı.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capacity_rule").insert({ tenant_id: tenantId, ...parse(formData) });
  if (error) throw new Error(error.message);
  revalidatePath("/rules");
  redirect("/rules");
}

export async function updateRule(id: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capacity_rule").update(parse(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rules");
  redirect("/rules");
}

export async function deleteRule(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capacity_rule").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rules");
}

export async function toggleRule(id: string, enabled: boolean) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("capacity_rule").update({ enabled }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/rules");
}
