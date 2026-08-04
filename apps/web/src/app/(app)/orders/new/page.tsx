import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOrder } from "@/app/actions/orders";
import { OrderForm } from "../OrderForm";

export default async function NewOrderPage() {
  const t = await getTranslations("orders");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
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

  return (
    <main>
      <h1>{t("newTitle")}</h1>
      <OrderForm action={createOrder} types={types} submitLabel={tc("create")} />
    </main>
  );
}
