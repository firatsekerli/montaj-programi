import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOrder } from "@/app/actions/orders";
import { OrderForm } from "../OrderForm";

export default async function NewOrderPage() {
  const t = await getTranslations("orders");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const [{ data: sites }, { data: types }] = await Promise.all([
    supabase.from("site").select("id, name").order("name"),
    supabase.from("work_item_type").select("id, name").order("name"),
  ]);

  return (
    <main>
      <h1>{t("newTitle")}</h1>
      <OrderForm
        action={createOrder}
        sites={sites ?? []}
        types={types ?? []}
        submitLabel={tc("create")}
      />
    </main>
  );
}
