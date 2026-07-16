import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";
import { mondayOf, weekDaysFrom } from "@/lib/planning";
import { PlanningBoard, type BoardAssignment } from "./Board";
import { GenerateButton } from "./GenerateButton";

function shiftWeek(weekStart: string, deltaDays: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekStart = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : mondayOf(new Date());
  const weekDays = weekDaysFrom(weekStart, 5);
  const t = await getTranslations("planning");
  const format = await getFormatter();
  const supabase = await createSupabaseServerClient();

  const [{ data: teams }, { data: plan }] = await Promise.all([
    supabase.from("team").select("id, name").order("preference_weight"),
    supabase.from("plan").select("id, unplaced").eq("date_from", weekStart).maybeSingle(),
  ]);

  interface Unplaced {
    orderCode: string;
    remaining: number;
    reason: "no_team" | "not_ready" | "no_capacity";
    readyDate: string | null;
  }
  const unplaced: Unplaced[] = (plan?.unplaced as Unplaced[] | undefined) ?? [];

  let assignments: BoardAssignment[] = [];
  if (plan) {
    const { data } = await supabase
      .from("assignment")
      .select(
        "id, team_id, assign_date, units, estimated_cost, work_order:order_id(code), order_line:order_line_id(work_item_type:work_item_type_id(name))",
      )
      .eq("plan_id", plan.id);
    assignments = (data ?? []).map((a) => {
      const wit = one<{ name: string }>(one<{ work_item_type: unknown }>(a.order_line)?.work_item_type);
      return {
        id: a.id,
        teamId: a.team_id,
        date: a.assign_date,
        units: a.units,
        cost: Number(a.estimated_cost ?? 0),
        orderCode: one<{ code: string }>(a.work_order)?.code ?? "",
        typeName: wit?.name ?? "",
      };
    });
  }

  return (
    <main>
      <div className="page-head">
        <h1>{t("title")}</h1>
        <GenerateButton weekStart={weekStart} hasPlan={Boolean(plan)} />
      </div>
      <p className="subtitle">{t("subtitle")}</p>

      <div className="week-nav">
        <Link href={`/planning?week=${shiftWeek(weekStart, -7)}`}>← {t("prevWeek")}</Link>
        <strong>
          {format.dateTime(new Date(`${weekStart}T00:00:00`), { day: "numeric", month: "long" })} —{" "}
          {format.dateTime(new Date(`${weekDays[weekDays.length - 1]}T00:00:00`), {
            day: "numeric",
            month: "long",
          })}
        </strong>
        <Link href={`/planning?week=${shiftWeek(weekStart, 7)}`}>{t("nextWeek")} →</Link>
      </div>

      {!plan && <p className="note">{t("noPlan")}</p>}
      {(teams ?? []).length === 0 ? (
        <p className="note">{t("noTeams")}</p>
      ) : (
        <PlanningBoard teams={teams ?? []} weekDays={weekDays} assignments={assignments} />
      )}

      {unplaced.length > 0 && (
        <div className="panel unplaced-panel">
          <h2>{t("unplacedTitle")}</h2>
          <p className="note">{t("unplacedNote")}</p>
          <ul className="unplaced-list">
            {unplaced.map((u, i) => (
              <li key={`${u.orderCode}-${i}`}>
                <span className="mono">{u.orderCode}</span>
                <span className="muted-cell">
                  {u.remaining} {t("unitsShort")}
                </span>
                <span className="badge sub">
                  {u.reason === "not_ready"
                    ? u.readyDate
                      ? t("reasonNotReadyDate", {
                          date: format.dateTime(new Date(`${u.readyDate}T00:00:00`), {
                            dateStyle: "medium",
                          }),
                        })
                      : t("reasonNotReady")
                    : u.reason === "no_team"
                      ? t("reasonNoTeam")
                      : t("reasonNoCapacity")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
