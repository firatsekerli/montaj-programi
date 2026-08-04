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
  const { data: row } = await supabase
    .from("work_order")
    .select("*, order_line(work_item_type_id, quantity)")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  // required_resource (0011) marks types that need a manlift; tolerant if behind.
  let typeRows = (await supabase.from("work_item_type").select("id, name, required_resource").order("name")).data as
    | Array<{ id: string; name: string; required_resource?: string | null }>
    | null;
  if (!typeRows) {
    typeRows = (await supabase.from("work_item_type").select("id, name").order("name")).data as typeof typeRows;
  }
  const types = (typeRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    requiresResource: Boolean(r.required_resource),
  }));

  // Collapse any duplicate-type rows (from the old accumulating-save bug) so the
  // form shows one line per type; saving then persists the cleaned-up set.
  const byType = new Map<string, number>();
  for (const l of (row.order_line ?? []) as Array<{ work_item_type_id: string; quantity: number }>) {
    byType.set(l.work_item_type_id, l.quantity);
  }
  const lines = [...byType].map(([work_item_type_id, quantity]) => ({ work_item_type_id, quantity }));

  return (
    <main>
      <h1>{t("editTitle")}</h1>
      <p className="subtitle">{row.code}</p>
      <OrderForm
        action={updateOrder.bind(null, id)}
        types={types}
        submitLabel={tc("save")}
        defaults={{
          code: row.code,
          district: (row as { district?: string | null }).district ?? null,
          accessOverhead: (row as { access_overhead_min?: number }).access_overhead_min ?? 0,
          orderDate: row.order_date,
          deliveryDate: row.delivery_date ?? undefined,
          productionDue: row.production_ready_date ?? undefined,
          requiresDemolition: row.requires_demolition,
          productionConfirmed: row.production_confirmed,
          requiresResource: row.requires_resource ?? true,
          status: row.status,
          lines,
        }}
      />
    </main>
  );
}
