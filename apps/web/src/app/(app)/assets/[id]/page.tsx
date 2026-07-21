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
  const [{ data: row }, { data: locations }, { data: teams }, { data: types }, { data: caps }] =
    await Promise.all([
      supabase.from("asset").select("*").eq("id", id).maybeSingle(),
      supabase.from("location").select("id, name").order("name"),
      supabase.from("team").select("id, name").order("name"),
      supabase.from("work_item_type").select("id, name").order("name"),
      supabase.from("asset_capacity").select("work_item_type_id, max_units").eq("asset_id", id),
    ]);
  if (!row) notFound();

  const carryCap: Record<string, number> = {};
  for (const c of (caps ?? []) as Array<{ work_item_type_id: string; max_units: number | null }>) {
    if (c.max_units != null) carryCap[c.work_item_type_id] = c.max_units;
  }

  return (
    <main>
      <h1>{t("editTitle")}</h1>
      <p className="subtitle">{row.name}</p>
      <AssetForm
        action={updateAsset.bind(null, id)}
        locations={locations ?? []}
        teams={teams ?? []}
        types={types ?? []}
        submitLabel={tc("save")}
        defaults={{
          name: row.name,
          kind: row.kind,
          tracksLocation: row.tracks_location,
          currentLocationId: row.current_location_id,
          teamId: row.team_id,
          resourceKind: row.resource_kind,
          carryCap,
        }}
      />
    </main>
  );
}
