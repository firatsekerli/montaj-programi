import { getTranslations } from "next-intl/server";
import { AssetLocationField } from "./AssetLocationField";

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

interface AssetOption {
  id: string;
  name: string;
}

export interface AssetCapacityDefault {
  min?: number | null;
  max?: number | null;
  maxLengthM?: number | null;
}

export async function AssetForm({
  action,
  assetId,
  locations,
  teams,
  types,
  assets,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Present when editing — enables the live location update. */
  assetId?: string;
  locations: LocationOption[];
  teams: TeamOption[];
  types: TypeOption[];
  /** Other assets, for the dependency picker. */
  assets: AssetOption[];
  defaults?: {
    name?: string;
    kind?: "vehicle" | "equipment";
    tracksLocation?: boolean;
    currentLocationId?: string | null;
    teamId?: string | null;
    resourceKind?: string | null;
    /** typeId → {min, max, maxLengthM}. */
    capacities?: Record<string, AssetCapacityDefault>;
    /** requiredAssetId → note. */
    dependencies?: Record<string, string>;
  };
  submitLabel: string;
}) {
  const t = await getTranslations("assets");
  const capacities = defaults.capacities ?? {};
  const dependencies = defaults.dependencies ?? {};
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
        <AssetLocationField
          assetId={assetId}
          locations={locations}
          defaultLocationId={defaults.currentLocationId}
        />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="tracks_location" defaultChecked={defaults.tracksLocation} />
        {t("tracksLocation")}
      </label>

      <fieldset>
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
      </fieldset>

      <fieldset>
        <legend>{t("capacityTitle")}</legend>
        <span className="help">{t("capacityHelp")}</span>
        {types.length === 0 ? (
          <p className="note">{t("noTypes")}</p>
        ) : (
          <div className="acap-list">
            <div className="acap-row acap-head">
              <span>{t("type")}</span>
              <span>{t("capMin")}</span>
              <span>{t("capMax")}</span>
              <span>{t("capLen")}</span>
            </div>
            {types.map((ty) => {
              const c = capacities[ty.id] ?? {};
              return (
                <div key={ty.id} className="acap-row">
                  <span className="acap-name">{ty.name}</span>
                  <input name={`capmin_${ty.id}`} type="number" min="0" step="1"
                    defaultValue={c.min ?? ""} placeholder="—" aria-label={`${ty.name} ${t("capMin")}`} />
                  <input name={`capmax_${ty.id}`} type="number" min="0" step="1"
                    defaultValue={c.max ?? ""} placeholder="—" aria-label={`${ty.name} ${t("capMax")}`} />
                  <input name={`caplen_${ty.id}`} type="number" min="0" step="0.1"
                    defaultValue={c.maxLengthM ?? ""} placeholder="—" aria-label={`${ty.name} ${t("capLen")}`} />
                </div>
              );
            })}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>{t("dependencyTitle")}</legend>
        <span className="help">{t("dependencyHelp")}</span>
        {assets.length === 0 ? (
          <p className="note">{t("noOtherAssets")}</p>
        ) : (
          <div className="dep-list">
            {assets.map((a) => {
              const checked = a.id in dependencies;
              return (
                <div key={a.id} className="dep-row">
                  <label className="checkbox">
                    <input type="checkbox" name="dependencies" value={a.id} defaultChecked={checked} />
                    {a.name}
                  </label>
                  <input
                    name={`depnote_${a.id}`}
                    defaultValue={dependencies[a.id] ?? ""}
                    placeholder={t("dependencyNote")}
                    aria-label={`${a.name} ${t("dependencyNote")}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </fieldset>

      <button type="submit" className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
