"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { fetchAudit } from "@/app/actions/audit";
import { AUDIT_ACTIONS, AUDIT_ACTION_SET, type AuditFilters, type AuditRow } from "./shared";

export function AuditTable({
  initialRows,
  initialHasMore,
  users,
  installers,
}: {
  initialRows: AuditRow[];
  initialHasMore: boolean;
  users: string[];
  installers: string[];
}) {
  const t = useTranslations("audit");
  const format = useFormatter();
  const [rows, setRows] = useState(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [pending, startTransition] = useTransition();
  const firstRun = useRef(true);

  // Refetch from the top whenever a filter changes (debounced so the order-code
  // text box doesn't fire a query per keystroke).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const id = setTimeout(() => {
      startTransition(async () => {
        const res = await fetchAudit(filters, 0);
        setRows(res.rows);
        setHasMore(res.hasMore);
      });
    }, 300);
    return () => clearTimeout(id);
  }, [filters]);

  function loadMore() {
    startTransition(async () => {
      const res = await fetchAudit(filters, rows.length);
      setRows((prev) => [...prev, ...res.rows]);
      setHasMore(res.hasMore);
    });
  }

  const set = (patch: Partial<AuditFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const actionLabel = (a: string) => (AUDIT_ACTION_SET.has(a) ? t(`actions.${a}`) : t("actions.other"));

  const fmtDate = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: "medium" });

  function detailOf(d: AuditRow["details"]) {
    const det = d as {
      installed?: number;
      of?: number;
      date?: string;
      count?: number;
      installers?: string[];
    };
    const parts: string[] = [];
    if (det.installed != null && det.of != null) parts.push(`${det.installed}/${det.of}`);
    if (det.count != null && det.date) parts.push(`${det.count} iş → ${fmtDate(det.date)}`);
    else if (det.date) parts.push(`→ ${fmtDate(det.date)}`);
    if (det.installers && det.installers.length) parts.push(`${t("installedBy")}: ${det.installers.join(", ")}`);
    return parts.join(" · ");
  }

  return (
    <div className="panel">
      <div className="audit-filters no-print">
        <label>
          {t("user")}
          <select value={filters.user ?? ""} onChange={(e) => set({ user: e.target.value || undefined })}>
            <option value="">{t("all")}</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("actionType")}
          <select value={filters.action ?? ""} onChange={(e) => set({ action: e.target.value || undefined })}>
            <option value="">{t("all")}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("orderCol")}
          <input
            type="search"
            value={filters.order ?? ""}
            placeholder={t("searchOrder")}
            onChange={(e) => set({ order: e.target.value || undefined })}
          />
        </label>
        <label>
          {t("installer")}
          <select value={filters.installer ?? ""} onChange={(e) => set({ installer: e.target.value || undefined })}>
            <option value="">{t("all")}</option>
            {installers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("when")}</th>
              <th>{t("user")}</th>
              <th>{t("action")}</th>
              <th>{t("orderCol")}</th>
              <th>{t("detail")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="muted-cell">
                  {format.dateTime(new Date(r.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td>{r.userName ?? "—"}</td>
                <td>{actionLabel(r.action)}</td>
                <td className="mono">{r.label ?? "—"}</td>
                <td className="muted-cell">{detailOf(r.details) || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="audit-more no-print">
          <button type="button" className="btn-ghost" onClick={loadMore} disabled={pending}>
            {pending ? t("loading") : t("loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
