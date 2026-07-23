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

interface Unplaced {
  orderCode: string;
  typeName?: string;
  remaining: number;
  reason: "no_team" | "not_ready" | "past_deadline" | "no_capacity";
  deliveryDate: string | null;
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekStart = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : mondayOf(new Date());
  const weekDays = weekDaysFrom(weekStart, 5);
  const weekEnd = weekDays[weekDays.length - 1]!;
  const t = await getTranslations("planning");
  const format = await getFormatter();
  const supabase = await createSupabaseServerClient();

  const [{ data: teams }, { data: plan }] = await Promise.all([
    supabase.from("team").select("id, name").order("preference_weight"),
    supabase.from("plan").select("id, unplaced").limit(1).maybeSingle(),
  ]);

  const unplaced: Unplaced[] = (plan?.unplaced as Unplaced[] | undefined) ?? [];

  let assignments: BoardAssignment[] = [];
  if (plan) {
    const cols =
      "id, team_id, assign_date, units, estimated_cost, work_order:order_id(code), order_line:order_line_id(work_item_type:work_item_type_id(name))";
    // Include `manual` (0014) when present; fall back if the migration is behind.
    const run = (sel: string) =>
      supabase
        .from("assignment")
        .select(sel)
        .eq("plan_id", plan.id)
        .gte("assign_date", weekStart)
        .lte("assign_date", weekEnd);
    let data = (await run(`${cols}, manual`)).data as Array<Record<string, unknown>> | null;
    if (!data) data = (await run(cols)).data as Array<Record<string, unknown>> | null;
    assignments = (data ?? []).map((a) => {
      const wit = one<{ name: string }>(one<{ work_item_type: unknown }>(a.order_line)?.work_item_type);
      return {
        id: String(a.id),
        teamId: String(a.team_id),
        date: String(a.assign_date),
        units: Number(a.units),
        cost: Number(a.estimated_cost ?? 0),
        orderCode: one<{ code: string }>(a.work_order)?.code ?? "",
        typeName: wit?.name ?? "",
        manual: a.manual === true,
      };
    });
  }

  return (
    <main>
      <div className="page-head">
        <h1>{t("title")}</h1>
        <GenerateButton hasPlan={Boolean(plan)} />
      </div>
      <p className="subtitle">{t("subtitle")}</p>

      <div className="week-nav">
        <Link href={`/planning?week=${shiftWeek(weekStart, -7)}`}>← {t("prevWeek")}</Link>
        <strong>
          {format.dateTime(new Date(`${weekStart}T00:00:00`), { day: "numeric", month: "long" })} —{" "}
          {format.dateTime(new Date(`${weekEnd}T00:00:00`), { day: "numeric", month: "long" })}
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
            {unplaced.map((uu, i) => (
              <li key={`${uu.orderCode}-${i}`}>
                <span className="mono">{uu.orderCode}</span>
                {uu.typeName && <span className="unplaced-type">{uu.typeName}</span>}
                <span className="muted-cell">
                  {uu.remaining} {t("unitsShort")}
                </span>
                <span className="badge sub">
                  {uu.reason === "not_ready"
                    ? t("reasonNotReady")
                    : uu.reason === "past_deadline"
                      ? uu.deliveryDate
                        ? t("reasonPastDeadline", {
                            date: format.dateTime(new Date(`${uu.deliveryDate}T00:00:00`), {
                              dateStyle: "medium",
                            }),
                          })
                        : t("reasonNotReady")
                      : uu.reason === "no_team"
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
