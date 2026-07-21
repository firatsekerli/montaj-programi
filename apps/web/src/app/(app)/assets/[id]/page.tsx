import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateAsset } from "@/app/actions/assets";
import { AssetForm, type AssetCapacityDefault } from "../AssetForm";

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("assets");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const [{ data: row }, { data: locations }, { data: teams }, { data: types }, { data: caps }, { data: deps }] =
    await Promise.all([
      supabase.from("asset").select("*").eq("id", id).maybeSingle(),
      supabase.from("location").select("id, name").order("name"),
      supabase.from("team").select("id, name").order("name"),
      supabase.from("work_item_type").select("id, name").order("name"),
      supabase.from("asset_capacity").select("work_item_type_id, min_units, max_units, max_size").eq("asset_id", id),
      supabase.from("asset_dependency").select("requires_asset_id, note").eq("asset_id", id),
    ]);
  if (!row) notFound();

  // Other assets (exclude self) for the dependency picker.
  const { data: others } = await supabase
    .from("asset")
    .select("id, name")
    .neq("id", id)
    .order("name");

  const capacities: Record<string, AssetCapacityDefault> = {};
  for (const c of (caps ?? []) as Array<{
    work_item_type_id: string;
    min_units: number | null;
    max_units: number | null;
    max_size: { max_length_m?: number } | null;
  }>) {
    capacities[c.work_item_type_id] = {
      min: c.min_units,
      max: c.max_units,
      maxLengthM: c.max_size?.max_length_m ?? null,
    };
  }

  const dependencies: Record<string, string> = {};
  for (const d of (deps ?? []) as Array<{ requires_asset_id: string; note: string | null }>) {
    dependencies[d.requires_asset_id] = d.note ?? "";
  }

  return (
    <main>
      <h1>{t("editTitle")}</h1>
      <p className="subtitle">{row.name}</p>
      <AssetForm
        action={updateAsset.bind(null, id)}
        assetId={id}
        locations={locations ?? []}
        teams={teams ?? []}
        types={types ?? []}
        assets={others ?? []}
        submitLabel={tc("save")}
        defaults={{
          name: row.name,
          kind: row.kind,
          tracksLocation: row.tracks_location,
          currentLocationId: row.current_location_id,
          teamId: row.team_id,
          resourceKind: row.resource_kind,
          capacities,
          dependencies,
        }}
      />
    </main>
  );
}
