import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAudit } from "@/app/actions/audit";
import { AuditTable } from "./AuditTable";

/** Audit history — who changed what, and when. Newest first, filterable. */
export default async function AuditPage() {
  const t = await getTranslations("audit");
  const supabase = await createSupabaseServerClient();

  // First page + the option lists that feed the filter dropdowns.
  const { rows, hasMore } = await fetchAudit({}, 0);

  const { data: userRows } = await supabase
    .from("audit_log")
    .select("user_name")
    .not("user_name", "is", null)
    .order("user_name")
    .limit(2000);
  const users = [...new Set(((userRows ?? []) as Array<{ user_name: string | null }>).map((r) => r.user_name).filter(Boolean) as string[])];

  const { data: people } = await supabase.from("person").select("name").order("name");
  const installers = ((people ?? []) as Array<{ name: string | null }>).map((p) => p.name).filter(Boolean) as string[];

  return (
    <main>
      <h1>{t("title")}</h1>
      <p className="subtitle">{t("subtitle")}</p>
      <AuditTable initialRows={rows} initialHasMore={hasMore} users={users} installers={installers} />
    </main>
  );
}
