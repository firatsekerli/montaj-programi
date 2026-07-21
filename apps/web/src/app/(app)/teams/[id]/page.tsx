import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateTeam } from "@/app/actions/teams";
import { TeamForm } from "../TeamForm";

export default async function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("teams");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  // Note: no daily_cap in this select — that column (migration 0008) may be
  // absent, and a failed embed here would surface as a confusing 404.
  const [{ data: row }, { data: people }, { data: types }, { data: locations }] = await Promise.all([
    supabase
      .from("team")
      .select("*, team_member(person_id), team_capability(work_item_type_id)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("person").select("id, name").order("name"),
    supabase.from("work_item_type").select("id, name").order("name"),
    supabase.from("location").select("id, name, lat, lon").order("name"),
  ]);
  if (!row) notFound();

  const memberIds = (row.team_member ?? []).map((m: { person_id: string }) => m.person_id);
  const capabilityIds = (row.team_capability ?? []).map(
    (c: { work_item_type_id: string }) => c.work_item_type_id,
  );

  // daily_cap fetched separately and tolerantly (ok if the column isn't there).
  const { data: capRows } = await supabase
    .from("team_capability")
    .select("work_item_type_id, daily_cap")
    .eq("team_id", id);
  const capabilityCaps: Record<string, number> = {};
  for (const c of (capRows ?? []) as Array<{ work_item_type_id: string; daily_cap: number | null }>) {
    if (c.daily_cap != null) capabilityCaps[c.work_item_type_id] = c.daily_cap;
  }

  return (
    <main>
      <h1>{t("editTitle")}</h1>
      <p className="subtitle">{row.name}</p>
      <TeamForm
        action={updateTeam.bind(null, id)}
        people={people ?? []}
        types={types ?? []}
        locations={locations ?? []}
        submitLabel={tc("save")}
        defaults={{
          name: row.name,
          isSubcontractor: row.is_subcontractor,
          preferenceWeight: row.preference_weight,
          baseLocationId: row.base_location_id,
          memberIds,
          capabilityIds,
          capabilityCaps,
        }}
      />
    </main>
  );
}
