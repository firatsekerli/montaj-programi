import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";

export default async function AssetsPage() {
  const t = await getTranslations("assets");
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("asset")
    .select("id, name, kind, tracks_location, current_location:current_location_id(name)")
    .order("name");

  return (
    <main>
      <h1>{t("title")}</h1>
      <p className="subtitle">{t("subtitle")}</p>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("kind")}</th>
              <th>{t("tracked")}</th>
              <th>{t("location")}</th>
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
                  <td className="muted-cell">{loc?.name ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
