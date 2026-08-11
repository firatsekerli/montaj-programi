import { getTranslations, getFormatter } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const KNOWN = new Set([
  "order.create",
  "order.update",
  "order.delete",
  "order.block",
  "order.unblock",
  "assignment.move",
  "assignment.bulk_move",
  "assignment.record",
  "assignment.undo",
  "plan.generate",
  "plan.clear",
]);

/** Audit history — who changed what, and when. Newest first. */
export default async function AuditPage() {
  const t = await getTranslations("audit");
  const format = await getFormatter();
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, user_name, action, label, details, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const actionLabel = (a: string) => (KNOWN.has(a) ? t(`actions.${a}`) : t("actions.other"));

  return (
    <main>
      <h1>{t("title")}</h1>
      <p className="subtitle">{t("subtitle")}</p>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>{t("when")}</th>
              <th>{t("user")}</th>
              <th>{t("action")}</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const d = (r.details ?? {}) as { installed?: number; of?: number; date?: string };
              const extra =
                d.installed != null && d.of != null
                  ? ` (${d.installed}/${d.of})`
                  : d.date
                    ? ` → ${d.date}`
                    : "";
              return (
                <tr key={r.id}>
                  <td className="muted-cell">
                    {format.dateTime(new Date(r.created_at as string), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td>{(r.user_name as string) ?? "—"}</td>
                  <td>
                    {actionLabel(r.action as string)}
                    {r.label ? ` — ${r.label as string}` : ""}
                    {extra}
                  </td>
                </tr>
              );
            })}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={3} className="empty">
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
