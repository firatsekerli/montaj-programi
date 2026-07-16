import { getTranslations } from "next-intl/server";

export async function SiteForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaults?: { name?: string; accessOverhead?: number };
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
      <button type="submit" className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
