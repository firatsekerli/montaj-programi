import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateWorkItemType } from "@/app/actions/work-item-types";
import { WorkItemTypeForm } from "../WorkItemTypeForm";

export default async function EditWorkItemTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("wit");
  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase.from("work_item_type").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();

  // Bind the id so the action has the same (formData) => void shape as create.
  const action = updateWorkItemType.bind(null, id);

  return (
    <main>
      <h1>{t("editTitle")}</h1>
      <p className="subtitle">{row.name}</p>
      <WorkItemTypeForm
        action={action}
        submitLabel={t("save")}
        defaults={{
          code: row.code,
          name: row.name,
          category: row.category ?? "",
          capacityModel: row.capacity_model,
          normal: row.base_capacity?.normal,
          overtime: row.base_capacity?.overtime,
          hoursPerUnit: row.effort?.hoursPerUnit,
        }}
      />
    </main>
  );
}
