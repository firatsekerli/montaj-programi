import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createTeam } from "@/app/actions/teams";
import { TeamForm } from "../TeamForm";

export default async function NewTeamPage() {
  const t = await getTranslations("teams");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const [{ data: people }, { data: types }, { data: locations }] = await Promise.all([
    supabase.from("person").select("id, name").order("name"),
    supabase.from("work_item_type").select("id, name").order("name"),
    supabase.from("location").select("id, name, lat, lon").order("name"),
  ]);

  return (
    <main>
      <h1>{t("newTitle")}</h1>
      <TeamForm
        action={createTeam}
        people={people ?? []}
        types={types ?? []}
        locations={locations ?? []}
        submitLabel={tc("create")}
      />
    </main>
  );
}
