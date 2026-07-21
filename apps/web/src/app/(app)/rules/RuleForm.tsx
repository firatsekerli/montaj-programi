"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const OPS = ["==", "!=", ">", ">=", "<", "<="] as const;
const EFFECTS = ["multiply_capacity", "add_units", "multiply_effort"] as const;
const KNOWN_VARS = [
  "line.leaf_width",
  "line.height",
  "line.area_m2",
  "order.requires_demolition",
  "team.headcount",
  "day.overtime",
];

export interface Clause {
  var: string;
  op: string;
  value: string;
}
export interface RuleDefaults {
  name?: string;
  enabled?: boolean;
  priority?: number;
  effectOp?: string;
  effectValue?: number;
  clauses?: Clause[];
}

export function RuleForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaults?: RuleDefaults;
  submitLabel: string;
}) {
  const t = useTranslations("rules");
  const [clauses, setClauses] = useState<Clause[]>(defaults.clauses ?? []);

  function update(i: number, patch: Partial<Clause>) {
    setClauses((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function add() {
    setClauses((prev) => [...prev, { var: KNOWN_VARS[0]!, op: ">", value: "" }]);
  }
  function remove(i: number) {
    setClauses((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <form action={action} className="form form-wide panel">
      <input type="hidden" name="clauses" value={JSON.stringify(clauses)} />

      <label>
        {t("name")}
        <input name="name" defaultValue={defaults.name} required />
      </label>

      <label className="checkbox">
        <input type="checkbox" name="enabled" defaultChecked={defaults.enabled ?? true} />
        {t("enabled")}
      </label>

      <label>
        {t("priority")}
        <input name="priority" type="number" defaultValue={defaults.priority ?? 100} />
      </label>

      <fieldset>
        <legend>{t("effect")}</legend>
        <div className="row-2">
          <label>
            {t("effectOp")}
            <select name="effect_op" defaultValue={defaults.effectOp ?? "multiply_capacity"}>
              {EFFECTS.map((e) => (
                <option key={e} value={e}>
                  {t(`effect_${e}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("effectValue")}
            <input
              name="effect_value"
              type="number"
              step="0.0001"
              defaultValue={defaults.effectValue ?? 1}
            />
          </label>
        </div>
        <span className="help">{t("effectHelp")}</span>
      </fieldset>

      <fieldset>
        <legend>{t("conditions")}</legend>
        <p className="help">{t("conditionsHelp")}</p>
        <datalist id="known-vars">
          {KNOWN_VARS.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        {clauses.length === 0 && <p className="note">{t("always")}</p>}
        {clauses.map((c, i) => (
          <div key={i} className="clause-row">
            <input
              list="known-vars"
              value={c.var}
              onChange={(e) => update(i, { var: e.target.value })}
              placeholder="line.height"
            />
            <select value={c.op} onChange={(e) => update(i, { op: e.target.value })}>
              {OPS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <input
              value={c.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="2400 / true"
            />
            <button type="button" className="link-danger" onClick={() => remove(i)} aria-label="×">
              ×
            </button>
          </div>
        ))}
        <button type="button" className="btn-ghost" onClick={add}>
          + {t("addCondition")}
        </button>
      </fieldset>

      <button type="submit" className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
