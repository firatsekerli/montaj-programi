import { getTranslations } from "next-intl/server";

export async function PersonForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaults?: { name?: string; isLead?: boolean };
  submitLabel: string;
}) {
  const t = await getTranslations("people");
  return (
    <form action={action} className="form form-wide panel">
      <label>
        {t("name")}
        <input name="name" defaultValue={defaults.name} required />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="is_lead" defaultChecked={defaults.isLead} />
        {t("isLead")}
      </label>
      <button type="submit" className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
