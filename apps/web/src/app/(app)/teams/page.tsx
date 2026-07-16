import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";
import { deleteTeam } from "@/app/actions/teams";

export default async function TeamsPage() {
  const t = await getTranslations("teams");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("team")
    .select(
      "id, name, is_subcontractor, team_member(person(name)), team_capability(work_item_type(name))",
    )
    .order("preference_weight");

  return (
    <main>
      <div className="page-head">
        <h1>{t("title")}</h1>
        <Link className="btn" href="/teams/new">
          {t("new")}
        </Link>
      </div>
      <p className="subtitle">{t("subtitle")}</p>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("kind")}</th>
              <th>{t("members")}</th>
              <th>{t("capabilities")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const members = (r.team_member ?? [])
                .map((m) => one<{ name: string }>(m.person)?.name)
                .filter(Boolean)
                .join(", ");
              const caps = (r.team_capability ?? [])
                .map((c) => one<{ name: string }>(c.work_item_type)?.name)
                .filter(Boolean)
                .join(", ");
              return (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>
                    <span className={r.is_subcontractor ? "badge sub" : "badge"}>
                      {r.is_subcontractor ? t("subcontractor") : t("inHouse")}
                    </span>
                  </td>
                  <td>{members || "—"}</td>
                  <td className="muted-cell">{caps || "—"}</td>
                  <td className="row-actions">
                    <Link href={`/teams/${r.id}`}>{tc("edit")}</Link>
                    <form action={deleteTeam.bind(null, r.id)}>
                      <button type="submit" className="link-danger">
                        {tc("delete")}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={5} className="empty">
                  {tc("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
