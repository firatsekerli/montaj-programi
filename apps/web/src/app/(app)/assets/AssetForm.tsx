import { getTranslations } from "next-intl/server";

interface LocationOption {
  id: string;
  name: string | null;
}

export async function AssetForm({
  action,
  locations,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  locations: LocationOption[];
  defaults?: {
    name?: string;
    kind?: "vehicle" | "equipment";
    tracksLocation?: boolean;
    currentLocationId?: string | null;
  };
  submitLabel: string;
}) {
  const t = await getTranslations("assets");
  return (
    <form action={action} className="form panel">
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
      <button type="submit" className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
