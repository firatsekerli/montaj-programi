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
  };
  submitLabel: string;
}) {
  const t = await getTranslations("teams");
  const memberSet = new Set(defaults.memberIds ?? []);
  const capSet = new Set(defaults.capabilityIds ?? []);

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
        {types.map((ty) => (
          <label key={ty.id} className="checkbox">
            <input
              type="checkbox"
              name="capabilities"
              value={ty.id}
              defaultChecked={capSet.has(ty.id)}
            />
            {ty.name}
          </label>
        ))}
      </fieldset>

      <button type="submit" className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
