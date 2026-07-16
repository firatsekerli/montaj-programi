import { getTranslations } from "next-intl/server";
import { createSite } from "@/app/actions/sites";
import { SiteForm } from "../SiteForm";

export default async function NewSitePage() {
  const t = await getTranslations("sites");
  const tc = await getTranslations("crud");
  return (
    <main>
      <h1>{t("newTitle")}</h1>
      <SiteForm action={createSite} submitLabel={tc("create")} />
    </main>
  );
}
