import { getTranslations } from "next-intl/server";
import { createPerson } from "@/app/actions/people";
import { PersonForm } from "../PersonForm";

export default async function NewPersonPage() {
  const t = await getTranslations("people");
  const tc = await getTranslations("crud");
  return (
    <main>
      <h1>{t("newTitle")}</h1>
      <PersonForm action={createPerson} submitLabel={tc("create")} />
    </main>
  );
}
