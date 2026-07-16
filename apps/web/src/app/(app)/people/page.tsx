import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deletePerson } from "@/app/actions/people";

export default async function PeoplePage() {
  const t = await getTranslations("people");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("person")
    .select("id, name, is_lead")
    .order("name");

  return (
    <main>
      <div className="page-head">
        <h1>{t("title")}</h1>
        <Link className="btn" href="/people/new">
          {t("new")}
        </Link>
      </div>
      <p className="subtitle">{t("subtitle")}</p>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("isLead")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>
                  <span className="badge">{r.is_lead ? t("lead") : t("member")}</span>
                </td>
                <td className="row-actions">
                  <Link href={`/people/${r.id}`}>{tc("edit")}</Link>
                  <form action={deletePerson.bind(null, r.id)}>
                    <button type="submit" className="link-danger">
                      {tc("delete")}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={3} className="empty">
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
