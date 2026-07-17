import { getTranslations } from "next-intl/server";

export async function SiteForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaults?: { name?: string; accessOverhead?: number; lat?: number | null; lon?: number | null };
  submitLabel: string;
}) {
  const t = await getTranslations("sites");
  return (
    <form action={action} className="form panel">
      <label>
        {t("name")}
        <input name="name" defaultValue={defaults.name} required />
      </label>
      <label>
        {t("accessOverhead")} ({t("min")})
        <input
          name="access_overhead_min"
          type="number"
          min="0"
          defaultValue={defaults.accessOverhead ?? 0}
        />
        <span className="help">{t("accessOverheadHelp")}</span>
      </label>
      <div className="row-2">
        <label>
          {t("lat")}
          <input name="lat" type="number" step="any" defaultValue={defaults.lat ?? ""} />
        </label>
        <label>
          {t("lon")}
          <input name="lon" type="number" step="any" defaultValue={defaults.lon ?? ""} />
        </label>
      </div>
      <span className="help">{t("coordsHelp")}</span>
      <button type="submit" className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
