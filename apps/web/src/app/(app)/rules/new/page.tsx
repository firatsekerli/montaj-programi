import { getTranslations } from "next-intl/server";
import { createRule } from "@/app/actions/rules";
import { RuleForm } from "../RuleForm";

export default async function NewRulePage() {
  const t = await getTranslations("rules");
  const tc = await getTranslations("crud");
  return (
    <main>
      <h1>{t("newTitle")}</h1>
      <p className="subtitle">{t("subtitle")}</p>
      <RuleForm action={createRule} submitLabel={tc("create")} />
    </main>
  );
}
