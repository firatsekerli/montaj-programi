import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateRule } from "@/app/actions/rules";
import { RuleForm, type Clause } from "../RuleForm";

export default async function EditRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("rules");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("capacity_rule")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  const effect = row.effect as { op: string; factor?: number; n?: number };
  const rawClauses = (row.condition as { all?: Array<{ var: string; op: string; value: unknown }> } | null)?.all ?? [];
  const clauses: Clause[] = rawClauses.map((c) => ({
    var: c.var,
    op: c.op,
    value: String(c.value),
  }));

  return (
    <main>
      <h1>{t("editTitle")}</h1>
      <p className="subtitle">{row.name}</p>
      <RuleForm
        action={updateRule.bind(null, id)}
        submitLabel={tc("save")}
        defaults={{
          name: row.name,
          enabled: row.enabled,
          priority: row.priority,
          effectOp: effect.op,
          effectValue: effect.n ?? effect.factor,
          clauses,
        }}
      />
    </main>
  );
}
