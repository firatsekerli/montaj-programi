import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { mondayOf } from "@/lib/planning";

export interface CalItem {
  code: string;
  team: string;
  units: number;
}
export interface CalDay {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  items: CalItem[];
}

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MAX_CHIPS = 3;

/**
 * Read-only month overview of the plan: one cell per day, each showing the
 * jobs scheduled that day. Clicking a day jumps to that week on the board.
 */
export async function MonthCalendar({
  monthISO,
  days,
  prevHref,
  nextHref,
}: {
  monthISO: string;
  days: CalDay[];
  prevHref: string;
  nextHref: string;
}) {
  const t = await getTranslations("calendar");
  const format = await getFormatter();
  const monthLabel = format.dateTime(new Date(`${monthISO}T00:00:00`), {
    month: "long",
    year: "numeric",
  });

  return (
    <section className="panel cal-panel">
      <div className="cal-head">
        <Link className="cal-nav" href={prevHref} aria-label={t("prev")}>
          ←
        </Link>
        <h2>{monthLabel}</h2>
        <Link className="cal-nav" href={nextHref} aria-label={t("next")}>
          →
        </Link>
      </div>

      <div className="cal-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-dow">
            {w}
          </div>
        ))}
        {days.map((d) => {
          const day = Number(d.date.slice(8, 10));
          const extra = d.items.length - MAX_CHIPS;
          return (
            <Link
              key={d.date}
              href={`/planning?week=${mondayOf(new Date(`${d.date}T00:00:00Z`))}`}
              className={`cal-cell${d.inMonth ? "" : " out"}${d.isToday ? " today" : ""}`}
            >
              <span className="cal-day">{day}</span>
              {d.items.slice(0, MAX_CHIPS).map((it, i) => (
                <span key={i} className="cal-chip" title={`${it.code} · ${it.team}`}>
                  <span className="cal-chip-code">{it.code}</span>
                  <span className="cal-chip-units">{it.units}</span>
                </span>
              ))}
              {extra > 0 && <span className="cal-more">+{extra}</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
