"use client";

import { useMemo, useState, useTransition } from "react";
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

export function TaskChecklist({ tasks }: { tasks: TaskItem[] }) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [kind, setKind] = useState<string>("all");
  const [showDone, setShowDone] = useState(false);

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

  // Pool the filter chips work over (respects the "show completed" toggle).
  const pool = useMemo(
    () => tasks.filter((task) => showDone || task.status !== "done"),
    [tasks, showDone],
  );
  const chipKinds = useMemo(
    () => [...new Set(pool.map((p) => p.kind))].sort((a, b) => orderOf(a) - orderOf(b)),
    [pool],
  );
  const countFor = (k: string) => pool.filter((p) => p.kind === k).length;

  // If the active kind filter no longer has anything to show, fall back to all.
  const activeKind = kind !== "all" && !chipKinds.includes(kind) ? "all" : kind;

  const sortTasks = (list: TaskItem[]) =>
    [...list].sort((a, b) => {
      if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
      const ao = isOverdue(a);
      const bo = isOverdue(b);
      if (ao !== bo) return ao ? -1 : 1;
      return (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");
    });

  const visible = pool.filter((p) => activeKind === "all" || p.kind === activeKind);

  // When showing everything, group by kind with a header; otherwise a flat list.
  const groups: Array<{ kind: string; items: TaskItem[] }> =
    activeKind === "all"
      ? chipKinds.map((k) => ({ kind: k, items: sortTasks(visible.filter((v) => v.kind === k)) }))
      : [{ kind: activeKind, items: sortTasks(visible) }];

  function renderItem(task: TaskItem) {
    const done = task.status === "done";
    return (
      <li key={task.id} className={`task-item${done ? " done" : ""}${isOverdue(task) ? " overdue" : ""}`}>
        <label>
          <input
            type="checkbox"
            checked={done}
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
      <div className="task-toolbar">
        <div className="task-filters">
          <button
            type="button"
            className={`task-filter${activeKind === "all" ? " active" : ""}`}
            onClick={() => setKind("all")}
          >
            {t("filterAll")} <span className="task-filter-count">{pool.length}</span>
          </button>
          {chipKinds.map((k) => (
            <button
              type="button"
              key={k}
              className={`task-filter${activeKind === k ? " active" : ""}`}
              onClick={() => setKind(k)}
            >
              {kindLabel(k)} <span className="task-filter-count">{countFor(k)}</span>
            </button>
          ))}
        </div>
        <label className="task-showdone">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          {t("showCompleted")}
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="empty">{t("empty")}</p>
      ) : (
        <div className={`task-groups${pending ? " busy" : ""}`}>
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.kind} className="task-group">
                {activeKind === "all" && (
                  <h2 className="task-group-head">
                    <span className={`task-kind kind-${g.kind}`}>{kindLabel(g.kind)}</span>
                    <span className="task-group-count">{g.items.length}</span>
                  </h2>
                )}
                <ul className="task-list">{g.items.map(renderItem)}</ul>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
