"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export interface WorkItemTypeDefaults {
  code?: string;
  name?: string;
  category?: string;
  capacityModel?: "count" | "effort";
  normal?: number;
  overtime?: number;
  hoursPerUnit?: number;
}

export function WorkItemTypeForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaults?: WorkItemTypeDefaults;
  submitLabel: string;
}) {
  const t = useTranslations("wit");
  const [model, setModel] = useState<"count" | "effort">(defaults.capacityModel ?? "count");

  return (
    <form action={action} className="form panel">
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
        <label>
          {t("hoursPerUnit")}
          <input
            name="hoursPerUnit"
            type="number"
            step="0.1"
            defaultValue={defaults.hoursPerUnit ?? 0}
          />
        </label>
      )}

      <button type="submit" className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
