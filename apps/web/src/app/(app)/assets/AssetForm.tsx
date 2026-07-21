import { getTranslations } from "next-intl/server";

interface LocationOption {
  id: string;
  name: string | null;
}

interface TeamOption {
  id: string;
  name: string;
}

interface TypeOption {
  id: string;
  name: string;
}

export async function AssetForm({
  action,
  locations,
  teams,
  types,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  locations: LocationOption[];
  teams: TeamOption[];
  types: TypeOption[];
  defaults?: {
    name?: string;
    kind?: "vehicle" | "equipment";
    tracksLocation?: boolean;
    currentLocationId?: string | null;
    teamId?: string | null;
    resourceKind?: string | null;
    /** typeId → max units/day this asset carries. */
    carryCap?: Record<string, number>;
  };
  submitLabel: string;
}) {
  const t = await getTranslations("assets");
  const carryCap = defaults.carryCap ?? {};
  return (
    <form action={action} className="form form-wide panel">
      <label>
        {t("name")}
        <input name="name" defaultValue={defaults.name} required />
      </label>
      <label>
        {t("kind")}
        <select name="kind" defaultValue={defaults.kind ?? "vehicle"}>
          <option value="vehicle">{t("vehicle")}</option>
          <option value="equipment">{t("equipment")}</option>
        </select>
      </label>
      <label>
        {t("location")}
        <select name="current_location_id" defaultValue={defaults.currentLocationId ?? ""}>
          <option value="">—</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name ?? l.id}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox">
        <input type="checkbox" name="tracks_location" defaultChecked={defaults.tracksLocation} />
        {t("tracksLocation")}
      </label>

      <fieldset className="subform">
        <legend>{t("fleetTitle")}</legend>
        <label>
          {t("team")}
          <select name="team_id" defaultValue={defaults.teamId ?? ""}>
            <option value="">{t("noTeam")}</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
        </label>
        <span className="help">{t("teamHelp")}</span>

        <label>
          {t("resourceKind")}
          <input name="resource_kind" defaultValue={defaults.resourceKind ?? ""} placeholder="manlift" />
        </label>
        <span className="help">{t("resourceKindHelp")}</span>

        {types.length > 0 && (
          <>
            <span className="field-label">{t("carryCap")}</span>
            <span className="help">{t("carryCapHelp")}</span>
            <div className="cap-list">
              {types.map((ty) => (
                <label key={ty.id} className="cap-row">
                  <span>{ty.name}</span>
                  <input
                    name={`cap_${ty.id}`}
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={carryCap[ty.id] ?? ""}
                    placeholder="—"
                  />
                </label>
              ))}
            </div>
          </>
        )}
      </fieldset>

      <button type="submit" className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
