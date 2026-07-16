"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Option {
  id: string;
  name: string | null;
}
interface Line {
  work_item_type_id: string;
  quantity: number;
}

const STATUSES = ["backlog", "planned", "in_progress", "completed", "blocked"] as const;

export function OrderForm({
  action,
  sites,
  types,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  sites: Option[];
  types: Option[];
  defaults?: {
    code?: string;
    siteId?: string;
    orderDate?: string;
    productionReadyDate?: string;
    requiresDemolition?: boolean;
    status?: string;
    lines?: Line[];
  };
  submitLabel: string;
}) {
  const t = useTranslations("orders");
  const ts = useTranslations("order.status");
  const tc = useTranslations("crud");
  const [lines, setLines] = useState<Line[]>(
    defaults.lines && defaults.lines.length
      ? defaults.lines
      : [{ work_item_type_id: types[0]?.id ?? "", quantity: 1 }],
  );

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { work_item_type_id: types[0]?.id ?? "", quantity: 1 }]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <form action={action} className="form panel">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <label>
        {t("code")}
        <input name="code" defaultValue={defaults.code} required />
      </label>

      <label>
        {t("site")}
        <select name="site_id" defaultValue={defaults.siteId ?? ""} required>
          <option value="" disabled>
            {t("site")}
          </option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name ?? s.id}
            </option>
          ))}
        </select>
      </label>

      <div className="row-2">
        <label>
          {t("orderDate")}
          <input name="order_date" type="date" defaultValue={defaults.orderDate} required />
        </label>
        <label>
          {t("productionReady")}
          <input
            name="production_ready_date"
            type="date"
            defaultValue={defaults.productionReadyDate}
          />
        </label>
      </div>
      <span className="help">{t("productionReadyHelp")}</span>

      <label>
        {t("status")}
        <select name="status" defaultValue={defaults.status ?? "backlog"}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ts(s)}
            </option>
          ))}
        </select>
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          name="requires_demolition"
          defaultChecked={defaults.requiresDemolition}
        />
        {t("requiresDemolition")}
      </label>

      <fieldset>
        <legend>{t("lines")}</legend>
        {lines.map((line, i) => (
          <div key={i} className="line-row">
            <select
              value={line.work_item_type_id}
              onChange={(e) => updateLine(i, { work_item_type_id: e.target.value })}
            >
              {types.map((ty) => (
                <option key={ty.id} value={ty.id}>
                  {ty.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={line.quantity}
              onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
              aria-label={t("quantity")}
            />
            <button
              type="button"
              className="link-danger"
              onClick={() => removeLine(i)}
              aria-label={tc("remove")}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="btn-ghost" onClick={addLine}>
          + {t("addLine")}
        </button>
      </fieldset>

      <button type="submit" className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
