import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";
import { deleteAsset } from "@/app/actions/assets";
import { AssetLocationField } from "./AssetLocationField";

export default async function AssetsPage() {
  const t = await getTranslations("assets");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const [{ data: rows }, { data: locations }] = await Promise.all([
    supabase
      .from("asset")
      .select("id, name, kind, tracks_location, current_location_id, current_location:current_location_id(name)")
      .order("name"),
    supabase.from("location").select("id, name").order("name"),
  ]);

  return (
    <main>
      <div className="page-head">
        <h1>{t("title")}</h1>
        <Link className="btn" href="/assets/new">
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
              <th>{t("tracked")}</th>
              <th>{t("location")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const loc = one<{ name: string }>(r.current_location);
              return (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.kind === "vehicle" ? t("vehicle") : t("equipment")}</td>
                  <td>{r.tracks_location ? t("yes") : "—"}</td>
                  <td className="muted-cell">
                    {r.tracks_location ? (
                      <AssetLocationField
                        assetId={r.id}
                        locations={locations ?? []}
                        defaultLocationId={r.current_location_id}
                      />
                    ) : (
                      (loc?.name ?? "—")
                    )}
                  </td>
                  <td className="row-actions">
                    <Link href={`/assets/${r.id}`}>{tc("edit")}</Link>
                    <form action={deleteAsset.bind(null, r.id)}>
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
