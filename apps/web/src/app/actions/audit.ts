"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AUDIT_PAGE, type AuditFilters, type AuditRow } from "@/app/(app)/audit/shared";

/**
 * Fetch one page of audit rows (newest first), applying the given filters.
 * Fetches AUDIT_PAGE+1 rows to tell the caller whether more remain.
 */
export async function fetchAudit(
  filters: AuditFilters,
  offset: number,
): Promise<{ rows: AuditRow[]; hasMore: boolean }> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("audit_log")
    .select("id, user_name, action, label, details, created_at")
    .order("created_at", { ascending: false });

  if (filters.user) q = q.eq("user_name", filters.user);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.order) q = q.ilike("label", `%${filters.order}%`);
  // details.installers is a JSON array of names; @> tests array membership.
  if (filters.installer) q = q.contains("details", { installers: [filters.installer] });

  const { data, error } = await q.range(offset, offset + AUDIT_PAGE);
  if (error) throw new Error(error.message);

  const all = (data ?? []) as Array<{
    id: string;
    user_name: string | null;
    action: string;
    label: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
  }>;
  const hasMore = all.length > AUDIT_PAGE;
  const rows: AuditRow[] = all.slice(0, AUDIT_PAGE).map((r) => ({
    id: r.id,
    userName: r.user_name,
    action: r.action,
    label: r.label,
    details: r.details ?? {},
    createdAt: r.created_at,
  }));
  return { rows, hasMore };
}
