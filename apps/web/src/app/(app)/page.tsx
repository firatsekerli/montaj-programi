import { getTranslations } from "next-intl/server";
import { dailyCapacity, type ShiftContext, type WorkItemType } from "@montaj/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";
import { addMonths, firstOfMonth, monthGrid } from "@/lib/planning";
import { MonthCalendar, type CalDay, type CalItem } from "./MonthCalendar";

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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const t = await getTranslations("home");
  const supabase = await createSupabaseServerClient();

  const { month } = await searchParams;
  const monthISO = month && /^\d{4}-\d{2}-01$/.test(month) ? month : firstOfMonth(new Date());
  const gridDays = monthGrid(monthISO);
  const gridStart = gridDays[0]!;
  const gridEnd = gridDays[gridDays.length - 1]!;
  const todayISO = new Date().toISOString().slice(0, 10);
  const monthNum = monthISO.slice(0, 7);

  const [{ data: types }, { data: setting }, counts, { data: plan }] = await Promise.all([
    supabase.from("work_item_type").select("*").order("name"),
    supabase.from("tenant_setting").select("normal_shift_hours, overtime_shift_hours").maybeSingle(),
    Promise.all([
      supabase.from("team").select("id", { count: "exact", head: true }),
      supabase.from("asset").select("id", { count: "exact", head: true }),
      supabase.from("site").select("id", { count: "exact", head: true }),
      supabase.from("work_order").select("id", { count: "exact", head: true }),
    ]),
    supabase.from("plan").select("id").limit(1).maybeSingle(),
  ]);

  // Jobs scheduled per day across the visible month grid.
  const itemsByDate = new Map<string, CalItem[]>();
  if (plan) {
    const { data: rows } = await supabase
      .from("assignment")
      .select("assign_date, units, team:team_id(name), work_order:order_id(code)")
      .eq("plan_id", plan.id)
      .gte("assign_date", gridStart)
      .lte("assign_date", gridEnd);
    for (const r of rows ?? []) {
      const list = itemsByDate.get(r.assign_date) ?? [];
      list.push({
        code: one<{ code: string }>(r.work_order)?.code ?? "",
        team: one<{ name: string }>(r.team)?.name ?? "",
        units: r.units,
      });
      itemsByDate.set(r.assign_date, list);
    }
  }
  const calDays: CalDay[] = gridDays.map((d) => ({
    date: d,
    inMonth: d.slice(0, 7) === monthNum,
    isToday: d === todayISO,
    items: itemsByDate.get(d) ?? [],
  }));

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

      <MonthCalendar
        monthISO={monthISO}
        days={calDays}
        prevHref={`/?month=${addMonths(monthISO, -1)}`}
        nextHref={`/?month=${addMonths(monthISO, 1)}`}
      />

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
