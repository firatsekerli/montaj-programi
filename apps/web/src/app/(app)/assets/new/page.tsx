import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAsset } from "@/app/actions/assets";
import { AssetForm } from "../AssetForm";

export default async function NewAssetPage() {
  const t = await getTranslations("assets");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const [{ data: locations }, { data: teams }, { data: types }, { data: assets }] = await Promise.all([
    supabase.from("location").select("id, name").order("name"),
    supabase.from("team").select("id, name").order("name"),
    supabase.from("work_item_type").select("id, name").order("name"),
    supabase.from("asset").select("id, name").order("name"),
  ]);

  return (
    <main>
      <h1>{t("newTitle")}</h1>
      <AssetForm
        action={createAsset}
        locations={locations ?? []}
        teams={teams ?? []}
        types={types ?? []}
        assets={assets ?? []}
        submitLabel={tc("create")}
      />
    </main>
  );
}
