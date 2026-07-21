import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteSite } from "@/app/actions/sites";

export default async function SitesPage() {
  const t = await getTranslations("sites");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  // Include `district` (0015) when present; fall back if the migration is behind.
  let rows = (
    await supabase.from("site").select("id, name, access_overhead_min, district").order("name")
  ).data as Array<{ id: string; name: string; access_overhead_min: number; district?: string | null }> | null;
  if (!rows) {
    rows = (
      await supabase.from("site").select("id, name, access_overhead_min").order("name")
    ).data as typeof rows;
  }

  return (
    <main>
      <div className="page-head">
        <h1>{t("title")}</h1>
        <Link className="btn" href="/sites/new">
          {t("new")}
        </Link>
      </div>
      <p className="subtitle">{t("subtitle")}</p>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("district")}</th>
              <th className="num-h">{t("accessOverhead")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="muted-cell">{r.district ?? "—"}</td>
                <td className="num">
                  {r.access_overhead_min} {t("min")}
                </td>
                <td className="row-actions">
                  <Link href={`/sites/${r.id}`}>{tc("edit")}</Link>
                  <form action={deleteSite.bind(null, r.id)}>
                    <button type="submit" className="link-danger">
                      {tc("delete")}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={4} className="empty">
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
