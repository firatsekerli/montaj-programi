"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { WitFormState } from "@/app/actions/work-item-types";

export interface WorkItemTypeDefaults {
  code?: string;
  name?: string;
  category?: string;
  capacityModel?: "count" | "effort";
  normal?: number;
  overtime?: number;
  hoursPerUnit?: number;
  scaleAttr?: string;
  scaleCoefficient?: number;
  requiredResource?: string;
  crewBaseline?: number;
  perPersonBonus?: number;
  allowParallelTeams?: boolean;
}

export function WorkItemTypeForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: (prev: WitFormState, formData: FormData) => Promise<WitFormState>;
  defaults?: WorkItemTypeDefaults;
  submitLabel: string;
}) {
  const t = useTranslations("wit");
  const [model, setModel] = useState<"count" | "effort">(defaults.capacityModel ?? "count");
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="form form-wide panel">
      {state?.error && <p className="form-error">{state.error}</p>}
      <label>
        {t("name")}
        <input name="name" defaultValue={defaults.name} required />
      </label>
      <label>
        {t("code")}
        <input name="code" defaultValue={defaults.code} required />
      </label>
      <label>
        {t("category")}
        <input name="category" defaultValue={defaults.category} />
      </label>
      <label>
        {t("model")}
        <select
          name="capacityModel"
          value={model}
          onChange={(e) => setModel(e.target.value as "count" | "effort")}
        >
          <option value="count">{t("count")}</option>
          <option value="effort">{t("effort")}</option>
        </select>
      </label>

      {model === "count" ? (
        <div className="row-2">
          <label>
            {t("normal")}
            <input name="normal" type="number" step="0.1" defaultValue={defaults.normal ?? 0} />
          </label>
          <label>
            {t("overtime")}
            <input name="overtime" type="number" step="0.1" defaultValue={defaults.overtime ?? 0} />
          </label>
        </div>
      ) : (
        <>
          <label>
            {t("hoursPerUnit")}
            <input
              name="hoursPerUnit"
              type="number"
              step="0.1"
              defaultValue={defaults.hoursPerUnit ?? 0}
            />
          </label>
          <div className="row-2">
            <label>
              {t("scaleAttr")}
              <input name="scaleAttr" defaultValue={defaults.scaleAttr} placeholder="area_m2" />
            </label>
            <label>
              {t("scaleCoefficient")}
              <input
                name="scaleCoefficient"
                type="number"
                step="0.0001"
                defaultValue={defaults.scaleCoefficient ?? 0}
              />
            </label>
          </div>
          <span className="help">{t("scaleHelp")}</span>
        </>
      )}

      <div className="row-2">
        <label>
          {t("crewBaseline")}
          <input
            name="crewBaseline"
            type="number"
            min="1"
            step="1"
            defaultValue={defaults.crewBaseline ?? 2}
          />
        </label>
        <label>
          {t("perPersonBonus")}
          <input
            name="perPersonBonus"
            type="number"
            min="0"
            step="0.1"
            defaultValue={defaults.perPersonBonus ?? 0}
          />
        </label>
      </div>
      <span className="help">{t("crewScalingHelp")}</span>

      <label>
        {t("requiredResource")}
        <input
          name="requiredResource"
          defaultValue={defaults.requiredResource}
          placeholder="manlift"
        />
      </label>
      <span className="help">{t("requiredResourceHelp")}</span>

      <label className="checkbox">
        <input
          type="checkbox"
          name="allowParallelTeams"
          defaultChecked={defaults.allowParallelTeams}
        />
        {t("allowParallelTeams")}
      </label>
      <span className="help">{t("allowParallelTeamsHelp")}</span>

      <button type="submit" className="btn" disabled={pending}>
        {submitLabel}
      </button>
    </form>
  );
}
