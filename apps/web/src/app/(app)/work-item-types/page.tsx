import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteWorkItemType } from "@/app/actions/work-item-types";

export default async function WorkItemTypesPage() {
  const t = await getTranslations("wit");
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase.from("work_item_type").select("*").order("name");

  return (
    <main>
      <div className="page-head">
        <h1>{t("title")}</h1>
        <Link className="btn" href="/work-item-types/new">
          {t("new")}
        </Link>
      </div>
      <p className="subtitle">{t("subtitle")}</p>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("code")}</th>
              <th>{t("model")}</th>
              <th className="num-h">{t("normal")}</th>
              <th className="num-h">{t("overtime")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="mono">{r.code}</td>
                <td>{r.capacity_model === "count" ? t("count") : t("effort")}</td>
                <td className="num">
                  {r.capacity_model === "count" ? r.base_capacity?.normal : "—"}
                </td>
                <td className="num">
                  {r.capacity_model === "count" ? r.base_capacity?.overtime : "—"}
                </td>
                <td className="row-actions">
                  <Link href={`/work-item-types/${r.id}`}>{t("edit")}</Link>
                  <form action={deleteWorkItemType.bind(null, r.id)}>
                    <button type="submit" className="link-danger">
                      {t("delete")}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={6} className="empty">
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
