import { getTranslations } from "next-intl/server";
import { ANKARA_DISTRICTS } from "@/lib/districts";

export async function SiteForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaults?: { name?: string; accessOverhead?: number; district?: string | null };
  submitLabel: string;
}) {
  const t = await getTranslations("sites");
  const districts = [...ANKARA_DISTRICTS].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  return (
    <form action={action} className="form form-wide panel">
      <label>
        {t("name")}
        <input name="name" defaultValue={defaults.name} required />
      </label>
      <label>
        {t("district")}
        <select name="district" defaultValue={defaults.district ?? ""} required>
          <option value="" disabled>
            {t("selectDistrict")}
          </option>
          {districts.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <span className="help">{t("districtHelp")}</span>
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
      <button type="submit" className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
