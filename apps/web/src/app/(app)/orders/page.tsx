import { getTranslations, getFormatter } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";

export default async function OrdersPage() {
  const t = await getTranslations("orders");
  const ts = await getTranslations("order.status");
  const format = await getFormatter();
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("work_order")
    .select(
      "id, code, order_date, production_ready_date, status, requires_demolition, site:site_id(name), order_line(quantity, work_item_type(name))",
    )
    .order("order_date");

  return (
    <main>
      <h1>{t("title")}</h1>
      <p className="subtitle">{t("subtitle")}</p>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>{t("code")}</th>
              <th>{t("site")}</th>
              <th>{t("orderDate")}</th>
              <th>{t("productionReady")}</th>
              <th>{t("items")}</th>
              <th>{t("statusCol")}</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const site = one<{ name: string }>(r.site);
              const items = (r.order_line ?? [])
                .map((l) => `${l.quantity}× ${one<{ name: string }>(l.work_item_type)?.name ?? ""}`)
                .join(", ");
              return (
                <tr key={r.id}>
                  <td className="mono">{r.code}</td>
                  <td>{site?.name ?? "—"}</td>
                  <td>{format.dateTime(new Date(r.order_date), { dateStyle: "medium" })}</td>
                  <td>
                    {r.production_ready_date
                      ? format.dateTime(new Date(r.production_ready_date), { dateStyle: "medium" })
                      : "—"}
                  </td>
                  <td className="muted-cell">{items || "—"}</td>
                  <td>
                    <span className="badge">{ts(r.status)}</span>
                    {r.requires_demolition && <span className="badge sub">{t("demolition")}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
