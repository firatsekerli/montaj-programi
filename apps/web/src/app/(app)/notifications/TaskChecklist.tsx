"use client";

import { useTransition } from "react";
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

export function TaskChecklist({ tasks }: { tasks: TaskItem[] }) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const KNOWN = new Set(["production_check", "manlift_transfer", "deadline_risk", "shipment"]);

  function toggle(task: TaskItem, done: boolean) {
    startTransition(async () => {
      if (done) await completeTask(task.id);
      else await reopenTask(task.id);
      router.refresh();
    });
  }

  if (tasks.length === 0) {
    return <p className="empty">{t("empty")}</p>;
  }

  return (
    <ul className={`task-list${pending ? " busy" : ""}`}>
      {tasks.map((task) => {
        const done = task.status === "done";
        const overdue =
          !done && task.dueDate ? task.dueDate < new Date().toISOString().slice(0, 10) : false;
        return (
          <li key={task.id} className={`task-item${done ? " done" : ""}${overdue ? " overdue" : ""}`}>
            <label>
              <input
                type="checkbox"
                checked={done}
                disabled={pending}
                onChange={(e) => toggle(task, e.target.checked)}
              />
              <span className="task-body">
                <span className="task-head">
                  <span className={`task-kind kind-${task.kind}`}>
                    {KNOWN.has(task.kind) ? t(`kind.${task.kind}`) : t("kind.other")}
                  </span>
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
      })}
    </ul>
  );
}
