import { getTranslations } from "next-intl/server";
import { createWorkItemType } from "@/app/actions/work-item-types";
import { WorkItemTypeForm } from "../WorkItemTypeForm";

export default async function NewWorkItemTypePage() {
  const t = await getTranslations("wit");
  return (
    <main>
      <h1>{t("newTitle")}</h1>
      <p className="subtitle">{t("subtitle")}</p>
      <WorkItemTypeForm action={createWorkItemType} submitLabel={t("create")} />
    </main>
  );
}
