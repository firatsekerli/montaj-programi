import { getTranslations, getFormatter } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";

/**
 * Operations notifications — currently the production-due reminders: for each
 * order, the date production must be complete so installation can meet the
 * delivery deadline.
 */
export default async function NotificationsPage() {
  const t = await getTranslations("notifications");
  const format = await getFormatter();
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("task")
    .select("id, kind, due_date, payload, status, work_order:related_order_id(code)")
    .eq("status", "open")
    .order("due_date", { nullsFirst: false });

  return (
    <main>
      <h1>{t("title")}</h1>
      <p className="subtitle">{t("subtitle")}</p>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>{t("order")}</th>
              <th>{t("due")}</th>
              <th>{t("message")}</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const code = one<{ code: string }>(r.work_order)?.code ?? "—";
              const message = (r.payload as { message?: string } | null)?.message ?? "";
              return (
                <tr key={r.id}>
                  <td className="mono">{code}</td>
                  <td>
                    {r.due_date
                      ? format.dateTime(new Date(`${r.due_date}T00:00:00`), { dateStyle: "medium" })
                      : "—"}
                  </td>
                  <td className="muted-cell">{message}</td>
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
