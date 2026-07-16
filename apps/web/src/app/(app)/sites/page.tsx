import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SitesPage() {
  const t = await getTranslations("sites");
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("site")
    .select("id, name, access_overhead_min")
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
              <th className="num-h">{t("accessOverhead")}</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="num">{r.access_overhead_min} {t("min")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
