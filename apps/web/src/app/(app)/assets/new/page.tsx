import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAsset } from "@/app/actions/assets";
import { AssetForm } from "../AssetForm";

export default async function NewAssetPage() {
  const t = await getTranslations("assets");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const { data: locations } = await supabase.from("location").select("id, name").order("name");

  return (
    <main>
      <h1>{t("newTitle")}</h1>
      <AssetForm action={createAsset} locations={locations ?? []} submitLabel={tc("create")} />
    </main>
  );
}
