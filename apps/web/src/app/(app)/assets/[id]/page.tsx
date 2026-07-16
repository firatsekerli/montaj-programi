import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateAsset } from "@/app/actions/assets";
import { AssetForm } from "../AssetForm";

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("assets");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const [{ data: row }, { data: locations }] = await Promise.all([
    supabase.from("asset").select("*").eq("id", id).maybeSingle(),
    supabase.from("location").select("id, name").order("name"),
  ]);
  if (!row) notFound();

  return (
    <main>
      <h1>{t("editTitle")}</h1>
      <p className="subtitle">{row.name}</p>
      <AssetForm
        action={updateAsset.bind(null, id)}
        locations={locations ?? []}
        submitLabel={tc("save")}
        defaults={{
          name: row.name,
          kind: row.kind,
          tracksLocation: row.tracks_location,
          currentLocationId: row.current_location_id,
        }}
      />
    </main>
  );
}
