import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";
import { OrdersTable, type OrderRow } from "./OrdersTable";

export default async function OrdersPage() {
  const t = await getTranslations("orders");
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("work_order")
    .select(
      "id, code, order_date, delivery_date, production_ready_date, status, requires_demolition, district, order_line(quantity, work_item_type(name))",
    )
    .order("delivery_date", { nullsFirst: false });

  const orders: OrderRow[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    district: ((r as { district?: string | null }).district ?? null) as string | null,
    orderDate: r.order_date as string,
    deliveryDate: (r.delivery_date as string | null) ?? null,
    productionDue: (r.production_ready_date as string | null) ?? null,
    items: (r.order_line ?? [])
      .map((l) => `${l.quantity}× ${one<{ name: string }>(l.work_item_type)?.name ?? ""}`)
      .join(", "),
    requiresDemolition: Boolean(r.requires_demolition),
    status: (r.status as string) ?? "backlog",
  }));

  return (
    <main>
      <div className="page-head">
        <h1>{t("title")}</h1>
        <Link className="btn" href="/orders/new">
          {t("new")}
        </Link>
      </div>
      <p className="subtitle">{t("subtitle")}</p>
      <OrdersTable orders={orders} />
    </main>
  );
}
