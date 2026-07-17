import { getTranslations } from "next-intl/server";

interface Option {
  id: string;
  name: string | null;
}

export async function TeamForm({
  action,
  people,
  types,
  locations,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  people: Option[];
  types: Option[];
  locations: Option[];
  defaults?: {
    name?: string;
    isSubcontractor?: boolean;
    preferenceWeight?: number;
    baseLocationId?: string | null;
    memberIds?: string[];
    capabilityIds?: string[];
    capabilityCaps?: Record<string, number>;
  };
  submitLabel: string;
}) {
  const t = await getTranslations("teams");
  const memberSet = new Set(defaults.memberIds ?? []);
  const capSet = new Set(defaults.capabilityIds ?? []);
  const caps = defaults.capabilityCaps ?? {};

  return (
    <form action={action} className="form panel">
      <label>
        {t("name")}
        <input name="name" defaultValue={defaults.name} required />
      </label>

      <label className="checkbox">
        <input type="checkbox" name="is_subcontractor" defaultChecked={defaults.isSubcontractor} />
        {t("isSubcontractor")}
      </label>

      <label>
        {t("preference")}
        <input
          name="preference_weight"
          type="number"
          defaultValue={defaults.preferenceWeight ?? 100}
        />
      </label>

      <label>
        {t("baseLocation")}
        <select name="base_location_id" defaultValue={defaults.baseLocationId ?? ""}>
          <option value="">—</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name ?? l.id}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>{t("members")}</legend>
        {people.map((p) => (
          <label key={p.id} className="checkbox">
            <input type="checkbox" name="members" value={p.id} defaultChecked={memberSet.has(p.id)} />
            {p.name}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>{t("capabilities")}</legend>
        <p className="help">{t("dailyCapHelp")}</p>
        {types.map((ty) => (
          <div key={ty.id} className="cap-row">
            <label className="checkbox">
              <input
                type="checkbox"
                name="capabilities"
                value={ty.id}
                defaultChecked={capSet.has(ty.id)}
              />
              {ty.name}
            </label>
            <input
              name={`cap_${ty.id}`}
              type="number"
              min="0"
              step="0.1"
              placeholder={t("dailyCap")}
              defaultValue={caps[ty.id] ?? ""}
              aria-label={`${ty.name} ${t("dailyCap")}`}
            />
          </div>
        ))}
      </fieldset>

      <button type="submit" className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
