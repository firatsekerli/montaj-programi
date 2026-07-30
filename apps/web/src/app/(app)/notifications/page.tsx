import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { one } from "@/lib/rel";
import { TaskChecklist, type TaskItem } from "./TaskChecklist";

/**
 * Operator task list — production-due reminders and manlift transfers. Each task
 * is a checkbox the operator ticks off when done; ticking calls completeTask,
 * un-ticking reopens it. Both open and recently-done tasks are shown so a
 * mistaken tick can be undone.
 */
export default async function NotificationsPage() {
  const t = await getTranslations("notifications");
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("task")
    .select("id, kind, due_date, payload, status, work_order:related_order_id(code)")
    .in("status", ["open", "done"])
    .order("status", { ascending: true })
    .order("due_date", { nullsFirst: false });

  const tasks: TaskItem[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    kind: (r.kind as string) ?? "other",
    dueDate: (r.due_date as string | null) ?? null,
    code: one<{ code: string }>(r.work_order)?.code ?? "—",
    message: (r.payload as { message?: string } | null)?.message ?? "",
    status: (r.status as string) ?? "open",
  }));

  return (
    <main>
      <h1>{t("title")}</h1>
      <p className="subtitle">{t("subtitle")}</p>
      <div className="panel">
        <TaskChecklist tasks={tasks} />
      </div>
    </main>
  );
}
