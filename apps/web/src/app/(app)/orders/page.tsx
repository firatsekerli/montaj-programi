import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";
import { deleteOrder } from "@/app/actions/orders";
import { StatusSelect } from "./StatusSelect";

export default async function OrdersPage() {
  const t = await getTranslations("orders");
  const tc = await getTranslations("crud");
  const format = await getFormatter();
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("work_order")
    .select(
      "id, code, order_date, delivery_date, production_ready_date, status, requires_demolition, site:site_id(name), order_line(quantity, work_item_type(name))",
    )
    .order("delivery_date", { nullsFirst: false });

  return (
    <main>
      <div className="page-head">
        <h1>{t("title")}</h1>
        <Link className="btn" href="/orders/new">
          {t("new")}
        </Link>
      </div>
      <p className="subtitle">{t("subtitle")}</p>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>{t("code")}</th>
              <th>{t("site")}</th>
              <th>{t("orderDate")}</th>
              <th>{t("deliveryDate")}</th>
              <th>{t("productionDue")}</th>
              <th>{t("items")}</th>
              <th>{t("statusCol")}</th>
              <th />
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
                    {r.delivery_date
                      ? format.dateTime(new Date(r.delivery_date), { dateStyle: "medium" })
                      : "—"}
                  </td>
                  <td className="muted-cell">
                    {r.production_ready_date
                      ? format.dateTime(new Date(r.production_ready_date), { dateStyle: "medium" })
                      : "—"}
                  </td>
                  <td className="muted-cell">
                    {items || "—"}
                    {r.requires_demolition && (
                      <span className="badge sub" style={{ marginInlineStart: "0.4rem" }}>
                        {t("demolition")}
                      </span>
                    )}
                  </td>
                  <td>
                    <StatusSelect orderId={r.id} status={r.status} />
                  </td>
                  <td className="row-actions">
                    <Link href={`/orders/${r.id}`}>{tc("edit")}</Link>
                    <form action={deleteOrder.bind(null, r.id)}>
                      <button type="submit" className="link-danger">
                        {tc("delete")}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={7} className="empty">
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
