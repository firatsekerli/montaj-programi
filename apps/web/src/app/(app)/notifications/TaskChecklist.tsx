"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { completeTask, reopenTask } from "@/app/actions/tasks";

export interface TaskItem {
  id: string;
  kind: string;
  dueDate: string | null;
  code: string;
  message: string;
  status: string;
}

const KNOWN = new Set(["production_check", "manlift_transfer", "deadline_risk", "shipment"]);
// Display priority: most urgent first, unknown kinds last.
const KIND_ORDER = ["deadline_risk", "production_check", "manlift_transfer", "shipment"];
const orderOf = (k: string) => {
  const i = KIND_ORDER.indexOf(k);
  return i === -1 ? KIND_ORDER.length : i;
};

const today = () => new Date().toISOString().slice(0, 10);

// Filter is either "all" open, a specific kind (open), or "done" (completed).
const DONE = "__done__";
// How many tasks to reveal per "load more" click.
const PAGE = 15;

export function TaskChecklist({ tasks }: { tasks: TaskItem[] }) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(PAGE);

  // Reset the visible window whenever any filter changes.
  useEffect(() => {
    setLimit(PAGE);
  }, [filter, query, overdueOnly, from, to]);

  const kindLabel = (k: string) => (KNOWN.has(k) ? t(`kind.${k}`) : t("kind.other"));
  const isOverdue = (task: TaskItem) =>
    task.status !== "done" && task.dueDate != null && task.dueDate < today();

  function toggle(task: TaskItem, done: boolean) {
    startTransition(async () => {
      if (done) await completeTask(task.id);
      else await reopenTask(task.id);
      router.refresh();
    });
  }

  const open = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);
  const done = useMemo(() => tasks.filter((task) => task.status === "done"), [tasks]);
  const openKinds = useMemo(
    () => [...new Set(open.map((p) => p.kind))].sort((a, b) => orderOf(a) - orderOf(b)),
    [open],
  );

  // If the active kind filter emptied out, fall back to all open.
  const activeFilter =
    filter !== "all" && filter !== DONE && !openKinds.includes(filter) ? "all" : filter;

  const sortTasks = (list: TaskItem[]) =>
    [...list].sort((a, b) => {
      const ao = isOverdue(a);
      const bo = isOverdue(b);
      if (ao !== bo) return ao ? -1 : 1;
      return (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");
    });

  const showingDone = activeFilter === DONE;
  const base = showingDone ? done : open;
  const q = query.trim().toLocaleLowerCase("tr");
  const matchesQuery = (task: TaskItem) =>
    !q ||
    task.code.toLocaleLowerCase("tr").includes(q) ||
    task.message.toLocaleLowerCase("tr").includes(q);
  const inRange = (task: TaskItem) => {
    if (!from && !to) return true;
    if (!task.dueDate) return false; // a date range excludes tasks with no due date
    if (from && task.dueDate < from) return false;
    if (to && task.dueDate > to) return false;
    return true;
  };
  const anyFilter = q !== "" || overdueOnly || from !== "" || to !== "";
  const visible = base.filter(
    (p) =>
      (activeFilter === "all" || showingDone || p.kind === activeFilter) &&
      matchesQuery(p) &&
      (!overdueOnly || isOverdue(p)) &&
      inRange(p),
  );

  // Group by kind under headers when several kinds are shown ("all" or "done").
  const grouped = activeFilter === "all" || showingDone;
  const kindsToShow = grouped
    ? [...new Set(visible.map((v) => v.kind))].sort((a, b) => orderOf(a) - orderOf(b))
    : [activeFilter];
  // Flat list in display order (kind order, then urgency), capped by the current
  // window; "load more" grows the window. Groups are rebuilt from the capped set.
  const orderedFlat = kindsToShow.flatMap((k) => sortTasks(visible.filter((v) => v.kind === k)));
  const limited = orderedFlat.slice(0, limit);
  const hasMore = orderedFlat.length > limited.length;
  const groups = kindsToShow.map((k) => ({
    kind: k,
    items: limited.filter((v) => v.kind === k),
  }));

  function renderItem(task: TaskItem) {
    const isDone = task.status === "done";
    return (
      <li key={task.id} className={`task-item${isDone ? " done" : ""}${isOverdue(task) ? " overdue" : ""}`}>
        <label>
          <input
            type="checkbox"
            checked={isDone}
            disabled={pending}
            onChange={(e) => toggle(task, e.target.checked)}
          />
          <span className="task-body">
            <span className="task-head">
              <span className={`task-kind kind-${task.kind}`}>{kindLabel(task.kind)}</span>
              {task.code !== "—" && <span className="mono">{task.code}</span>}
              {task.dueDate && (
                <span className="task-due">
                  {t("dueShort")}:{" "}
                  {format.dateTime(new Date(`${task.dueDate}T00:00:00`), { dateStyle: "medium" })}
                </span>
              )}
            </span>
            <span className="task-message">{task.message}</span>
          </span>
        </label>
      </li>
    );
  }

  if (tasks.length === 0) {
    return <p className="empty">{t("empty")}</p>;
  }

  return (
    <div>
      <div className="task-filters">
        <button
          type="button"
          className={`task-filter${activeFilter === "all" ? " active" : ""}`}
          onClick={() => setFilter("all")}
        >
          {t("filterAll")} <span className="task-filter-count">{open.length}</span>
        </button>
        {openKinds.map((k) => (
          <button
            type="button"
            key={k}
            className={`task-filter${activeFilter === k ? " active" : ""}`}
            onClick={() => setFilter(k)}
          >
            {kindLabel(k)} <span className="task-filter-count">{open.filter((p) => p.kind === k).length}</span>
          </button>
        ))}
        <button
          type="button"
          className={`task-filter done-filter${showingDone ? " active" : ""}`}
          onClick={() => setFilter(DONE)}
        >
          {t("completed")} <span className="task-filter-count">{done.length}</span>
        </button>
      </div>

      <div className="task-controls">
        <input
          type="search"
          className="list-search"
          value={query}
          placeholder={t("searchOrder")}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="task-toggle">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
          />
          {t("overdueOnly")}
        </label>
        <div className="task-range">
          <span className="task-range-label">{t("dueRange")}</span>
          <input
            type="date"
            aria-label={t("rangeFrom")}
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="task-range-sep">–</span>
          <input
            type="date"
            aria-label={t("rangeTo")}
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        {anyFilter && (
          <button
            type="button"
            className="task-clear"
            onClick={() => {
              setQuery("");
              setOverdueOnly(false);
              setFrom("");
              setTo("");
            }}
          >
            {t("clearFilters")}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="empty">{anyFilter ? t("noMatch") : showingDone ? t("noCompleted") : t("empty")}</p>
      ) : (
        <div className={`task-groups${pending ? " busy" : ""}`}>
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.kind} className="task-group">
                {grouped && (
                  <h2 className="task-group-head">
                    <span className={`task-kind kind-${g.kind}`}>{kindLabel(g.kind)}</span>
                    <span className="task-group-count">{g.items.length}</span>
                  </h2>
                )}
                <ul className="task-list">{g.items.map(renderItem)}</ul>
              </section>
            ))}
          {hasMore && (
            <div className="audit-more">
              <button type="button" className="btn-ghost" onClick={() => setLimit((n) => n + PAGE)}>
                {t("loadMore")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
