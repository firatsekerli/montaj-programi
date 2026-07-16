import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateOrder } from "@/app/actions/orders";
import { OrderForm } from "../OrderForm";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("orders");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const [{ data: row }, { data: sites }, { data: types }] = await Promise.all([
    supabase
      .from("work_order")
      .select("*, order_line(work_item_type_id, quantity)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("site").select("id, name").order("name"),
    supabase.from("work_item_type").select("id, name").order("name"),
  ]);
  if (!row) notFound();

  const lines = (row.order_line ?? []).map(
    (l: { work_item_type_id: string; quantity: number }) => ({
      work_item_type_id: l.work_item_type_id,
      quantity: l.quantity,
    }),
  );

  return (
    <main>
      <h1>{t("editTitle")}</h1>
      <p className="subtitle">{row.code}</p>
      <OrderForm
        action={updateOrder.bind(null, id)}
        sites={sites ?? []}
        types={types ?? []}
        submitLabel={tc("save")}
        defaults={{
          code: row.code,
          siteId: row.site_id,
          orderDate: row.order_date,
          productionReadyDate: row.production_ready_date ?? undefined,
          requiresDemolition: row.requires_demolition,
          status: row.status,
          lines,
        }}
      />
    </main>
  );
}
