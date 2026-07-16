import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateSite } from "@/app/actions/sites";
import { SiteForm } from "../SiteForm";

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("sites");
  const tc = await getTranslations("crud");
  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase.from("site").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();

  return (
    <main>
      <h1>{t("editTitle")}</h1>
      <p className="subtitle">{row.name}</p>
      <SiteForm
        action={updateSite.bind(null, id)}
        submitLabel={tc("save")}
        defaults={{ name: row.name, accessOverhead: row.access_overhead_min }}
      />
    </main>
  );
}
