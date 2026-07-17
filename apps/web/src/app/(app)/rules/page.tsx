import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteRule } from "@/app/actions/rules";

interface Clause {
  var: string;
  op: string;
  value: unknown;
}
interface Effect {
  op: string;
  factor?: number;
  n?: number;
}

function conditionSummary(condition: unknown, always: string): string {
  const all = (condition as { all?: Clause[] } | null)?.all;
  if (!all || all.length === 0) return always;
  return all.map((c) => `${c.var} ${c.op} ${String(c.value)}`).join(" ve ");
}

function effectSummary(effect: Effect, t: (k: string) => string): string {
  if (effect.op === "add_units") return `${t("effect_add_units")}: +${effect.n}`;
  if (effect.op === "multiply_effort") return `${t("effect_multiply_effort")}: ×${effect.factor}`;
  return `${t("effect_multiply_capacity")}: ×${effect.factor}`;
}

export default async function RulesPage() {
  const t = await getTranslations("rules");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("capacity_rule")
    .select("id, name, enabled, priority, condition, effect")
    .order("priority");

  return (
    <main>
      <div className="page-head">
        <h1>{t("title")}</h1>
        <Link className="btn" href="/rules/new">
          {t("new")}
        </Link>
      </div>
      <p className="subtitle">{t("subtitle")}</p>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("conditions")}</th>
              <th>{t("effect")}</th>
              <th>{t("enabled")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="muted-cell">{conditionSummary(r.condition, t("always"))}</td>
                <td>{effectSummary(r.effect as Effect, t)}</td>
                <td>
                  <span className={r.enabled ? "badge" : "badge sub"}>
                    {r.enabled ? tc("yes") : "—"}
                  </span>
                </td>
                <td className="row-actions">
                  <Link href={`/rules/${r.id}`}>{tc("edit")}</Link>
                  <form action={deleteRule.bind(null, r.id)}>
                    <button type="submit" className="link-danger">
                      {tc("delete")}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={5} className="empty">
                  {tc("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
