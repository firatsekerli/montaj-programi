import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updatePerson } from "@/app/actions/people";
import { PersonForm } from "../PersonForm";

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("people");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase.from("person").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();

  return (
    <main>
      <h1>{t("editTitle")}</h1>
      <p className="subtitle">{row.name}</p>
      <PersonForm
        action={updatePerson.bind(null, id)}
        submitLabel={tc("save")}
        defaults={{ name: row.name, isLead: row.is_lead }}
      />
    </main>
  );
}
