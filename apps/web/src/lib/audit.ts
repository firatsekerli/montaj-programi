import { getCurrentContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AuditInput {
  action: string;
  entity?: string;
  entityId?: string | null;
  label?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Record who did what. Best-effort — auditing must NEVER break the operation it
 * describes, so any failure (e.g. a lagging migration) is swallowed.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const { tenantId, user, userName } = await getCurrentContext();
    if (!tenantId) return;
    const supabase = await createSupabaseServerClient();
    await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      user_id: user?.id ?? null,
      user_name: userName ?? null,
      action: input.action,
      entity: input.entity ?? null,
      entity_id: input.entityId ?? null,
      label: input.label ?? null,
      details: input.details ?? {},
    });
  } catch {
    // best-effort: ignore
  }
}
