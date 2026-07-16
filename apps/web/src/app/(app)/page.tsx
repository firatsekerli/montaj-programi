import { getTranslations } from "next-intl/server";
import { dailyCapacity, type ShiftContext, type WorkItemType } from "@montaj/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface WitRow {
  id: string;
  name: string;
  code: string;
  capacity_model: "count" | "effort";
  base_capacity: { normal: number; overtime: number } | null;
  effort: { hoursPerUnit: number } | null;
}

function toEngineType(row: WitRow): WorkItemType {
  return {
    id: row.id,
    code: row.code,
    capacityModel: row.capacity_model,
    baseCapacity: row.base_capacity ?? undefined,
    effort: row.effort ?? undefined,
  };
}

export default async function DashboardPage() {
  const t = await getTranslations("home");
  const supabase = await createSupabaseServerClient();

  const [{ data: types }, { data: setting }, counts] = await Promise.all([
    supabase.from("work_item_type").select("*").order("name"),
    supabase.from("tenant_setting").select("normal_shift_hours, overtime_shift_hours").maybeSingle(),
    Promise.all([
      supabase.from("team").select("id", { count: "exact", head: true }),
      supabase.from("asset").select("id", { count: "exact", head: true }),
      supabase.from("site").select("id", { count: "exact", head: true }),
      supabase.from("work_order").select("id", { count: "exact", head: true }),
    ]),
  ]);

  const normal = Number(setting?.normal_shift_hours ?? 9);
  const overtime = Number(setting?.overtime_shift_hours ?? 12);
  const shiftNormal: ShiftContext = {
    overtime: false,
    normalShiftHours: normal,
    overtimeShiftHours: overtime,
  };
  const shiftOvertime: ShiftContext = { ...shiftNormal, overtime: true };

  const [teams, assets, sites, orders] = counts.map((c) => c.count ?? 0);

  const stats = [
    { label: t("statOrders"), value: orders },
    { label: t("statTypes"), value: types?.length ?? 0 },
    { label: t("statTeams"), value: teams },
    { label: t("statAssets"), value: assets },
    { label: t("statSites"), value: sites },
  ];

  return (
    <main>
      <h1>{t("title")}</h1>
      <p className="subtitle">{t("subtitle")}</p>

      <section className="stats">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>{t("capacityDemoTitle")}</h2>
        <p className="note">{t("capacityDemoNote")}</p>
        <table>
          <thead>
            <tr>
              <th>{t("colType")}</th>
              <th className="num-h">{t("normal")}</th>
              <th className="num-h">{t("overtime")}</th>
            </tr>
          </thead>
          <tbody>
            {(types ?? []).map((row: WitRow) => {
              const type = toEngineType(row);
              return (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td className="num">{dailyCapacity(type, shiftNormal, [])}</td>
                  <td className="num">{dailyCapacity(type, shiftOvertime, [])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
