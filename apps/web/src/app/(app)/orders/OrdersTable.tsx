"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { deleteOrder } from "@/app/actions/orders";
import { StatusSelect } from "./StatusSelect";

export interface OrderRow {
  id: string;
  code: string;
  district: string | null;
  orderDate: string;
  deliveryDate: string | null;
  productionDue: string | null;
  items: string;
  requiresDemolition: boolean;
  status: string;
}

const STATUSES = ["backlog", "planned", "in_progress", "completed", "blocked"] as const;

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  const t = useTranslations("orders");
  const tc = useTranslations("crud");
  const ts = useTranslations("order.status");
  const format = useFormatter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [district, setDistrict] = useState<string>("all");

  const districts = useMemo(
    () =>
      [...new Set(orders.map((o) => o.district).filter(Boolean))].sort((a, b) =>
        (a as string).localeCompare(b as string, "tr"),
      ) as string[],
    [orders],
  );
  const countFor = (s: string) => orders.filter((o) => o.status === s).length;

  const visible = orders.filter(
    (o) =>
      (status === "all" || o.status === status) &&
      (district === "all" || o.district === district) &&
      (q.trim() === "" || o.code.toLowerCase().includes(q.trim().toLowerCase())),
  );

  const fmt = (iso: string | null) =>
    iso ? format.dateTime(new Date(`${iso}T00:00:00`), { dateStyle: "medium" }) : "—";

  return (
    <div className="panel">
      <div className="list-toolbar">
        <input
          className="list-search"
          type="search"
          placeholder={t("searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="chip-row">
          <button
            type="button"
            className={`task-filter${status === "all" ? " active" : ""}`}
            onClick={() => setStatus("all")}
          >
            {t("filterAll")} <span className="task-filter-count">{orders.length}</span>
          </button>
          {STATUSES.filter((s) => countFor(s) > 0).map((s) => (
            <button
              type="button"
              key={s}
              className={`task-filter${status === s ? " active" : ""}`}
              onClick={() => setStatus(s)}
            >
              {ts(s)} <span className="task-filter-count">{countFor(s)}</span>
            </button>
          ))}
        </div>
        <select
          className="list-district"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          aria-label={t("district")}
        >
          <option value="all">{t("allDistricts")}</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>{t("code")}</th>
            <th>{t("district")}</th>
            <th>{t("orderDate")}</th>
            <th>{t("deliveryDate")}</th>
            <th>{t("productionDue")}</th>
            <th>{t("items")}</th>
            <th>{t("statusCol")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.id}>
              <td className="mono uppercase">{r.code}</td>
              <td>{r.district ?? "—"}</td>
              <td>{fmt(r.orderDate)}</td>
              <td>{fmt(r.deliveryDate)}</td>
              <td className="muted-cell">{fmt(r.productionDue)}</td>
              <td className="muted-cell">
                {r.items || "—"}
                {r.requiresDemolition && (
                  <span className="badge sub" style={{ marginInlineStart: "0.4rem" }}>
                    {t("demolition")}
                  </span>
                )}
              </td>
              <td>
                <StatusSelect orderId={r.id} status={r.status} />
              </td>
              <td className="row-actions">
                <Link href={`/orders/${r.id}`}>{tc("edit")}</Link>
                <form action={deleteOrder.bind(null, r.id)}>
                  <button type="submit" className="link-danger">
                    {tc("delete")}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={8} className="empty">
                {orders.length === 0 ? tc("empty") : t("noMatch")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
