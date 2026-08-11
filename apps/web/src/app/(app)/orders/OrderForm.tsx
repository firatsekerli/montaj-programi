"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ANKARA_DISTRICTS } from "@/lib/districts";
import type { OrderFormState } from "@/app/actions/orders";

interface Option {
  id: string;
  name: string | null;
}
interface TypeOption extends Option {
  /** True when this type needs a shared resource (e.g. industrial → manlift). */
  requiresResource?: boolean;
}

const DISTRICTS = [...ANKARA_DISTRICTS].sort((a, b) => a.name.localeCompare(b.name, "tr"));
interface Line {
  work_item_type_id: string;
  quantity: number;
}

export function OrderForm({
  action,
  types,
  defaults = {},
  submitLabel,
}: {
  action: (prev: OrderFormState, formData: FormData) => Promise<OrderFormState>;
  types: TypeOption[];
  defaults?: {
    code?: string;
    district?: string | null;
    accessOverhead?: number;
    orderDate?: string;
    deliveryDate?: string;
    productionDue?: string;
    requiresDemolition?: boolean;
    productionConfirmed?: boolean;
    requiresResource?: boolean;
    status?: string;
    customerName?: string | null;
    customerSurname?: string | null;
    customerPhone?: string | null;
    lines?: Line[];
  };
  submitLabel: string;
}) {
  const t = useTranslations("orders");
  const tc = useTranslations("crud");
  const [state, formAction, pending] = useActionState(action, {});
  // Controlled so the pickers can enforce order_date ≤ delivery_date live.
  const [orderDate, setOrderDate] = useState(defaults.orderDate ?? "");
  const [deliveryDate, setDeliveryDate] = useState(defaults.deliveryDate ?? "");
  const [lines, setLines] = useState<Line[]>(
    defaults.lines && defaults.lines.length
      ? defaults.lines
      : [{ work_item_type_id: types[0]?.id ?? "", quantity: 1 }],
  );

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => {
      // Each type appears at most once — add the first type not already on a line.
      const used = new Set(prev.map((l) => l.work_item_type_id));
      const next = types.find((ty) => !used.has(ty.id));
      if (!next) return prev; // every type is already listed
      return [...prev, { work_item_type_id: next.id, quantity: 1 }];
    });
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <form action={formAction} className="form form-wide panel">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <label>
        {t("code")}
        <input name="code" defaultValue={defaults.code} required />
      </label>

      <fieldset>
        <legend>{t("customer")}</legend>
        <div className="row-2">
          <label>
            {t("customerName")}
            <input name="customer_name" defaultValue={defaults.customerName ?? ""} />
          </label>
          <label>
            {t("customerSurname")}
            <input name="customer_surname" defaultValue={defaults.customerSurname ?? ""} />
          </label>
        </div>
        <label>
          {t("customerPhone")}
          <input
            name="customer_phone"
            type="tel"
            defaultValue={defaults.customerPhone ?? ""}
          />
        </label>
        <span className="help">{t("customerHelp")}</span>
      </fieldset>

      <div className="row-2">
        <label>
          {t("district")}
          <select name="district" defaultValue={defaults.district ?? ""} required>
            <option value="" disabled>
              {t("selectDistrict")}
            </option>
            {DISTRICTS.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("accessOverhead")}
          <input
            name="access_overhead_min"
            type="number"
            min="0"
            defaultValue={defaults.accessOverhead ?? 0}
          />
        </label>
      </div>
      <span className="help">{t("accessOverheadHelp")}</span>

      <div className="row-2">
        <label>
          {t("orderDate")}
          <input
            name="order_date"
            type="date"
            value={orderDate}
            max={deliveryDate || undefined}
            onChange={(e) => setOrderDate(e.target.value)}
            required
          />
        </label>
        <label>
          {t("deliveryDate")}
          <input
            name="delivery_date"
            type="date"
            value={deliveryDate}
            min={orderDate || undefined}
            onChange={(e) => setDeliveryDate(e.target.value)}
            required
          />
        </label>
      </div>
      <span className="help">{t("deliveryDateHelp")}</span>
      {defaults.productionDue && (
        <p className="note">{t("productionDueInfo", { date: defaults.productionDue })}</p>
      )}

      {/* Status is auto-derived (Bekleyen → Planlandı → Devam ediyor → Tamamlandı)
          from the plan and installs. The only manual lever is blocking the order
          out of planning. `current_status` preserves the auto value on save. */}
      <input type="hidden" name="current_status" value={defaults.status ?? "backlog"} />
      <label className="checkbox">
        <input type="checkbox" name="blocked" defaultChecked={defaults.status === "blocked"} />
        {t("blockedLabel")}
      </label>
      <span className="help">{t("blockedHelp")}</span>

      <label className="checkbox">
        <input
          type="checkbox"
          name="requires_demolition"
          defaultChecked={defaults.requiresDemolition}
        />
        {t("requiresDemolition")}
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          name="production_confirmed"
          defaultChecked={defaults.productionConfirmed}
        />
        {t("productionConfirmed")}
      </label>

      {lines.some((l) => types.find((ty) => ty.id === l.work_item_type_id)?.requiresResource) && (
        <>
          <label className="checkbox">
            <input
              type="checkbox"
              name="requires_resource"
              defaultChecked={defaults.requiresResource ?? true}
            />
            {t("requiresManlift")}
          </label>
          <span className="help">{t("requiresManliftHelp")}</span>
        </>
      )}

      <fieldset>
        <legend>{t("lines")}</legend>
        {lines.map((line, i) => (
          <div key={i} className="line-row">
            <select
              value={line.work_item_type_id}
              onChange={(e) => updateLine(i, { work_item_type_id: e.target.value })}
            >
              {types
                .filter(
                  (ty) =>
                    ty.id === line.work_item_type_id ||
                    !lines.some((o, oi) => oi !== i && o.work_item_type_id === ty.id),
                )
                .map((ty) => (
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
        <button
          type="button"
          className="btn-ghost"
          onClick={addLine}
          disabled={lines.length >= types.length}
        >
          + {t("addLine")}
        </button>
      </fieldset>

      {state?.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn" disabled={pending}>
        {submitLabel}
      </button>
    </form>
  );
}
