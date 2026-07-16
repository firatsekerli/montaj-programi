import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CurrentContext {
  user: User | null;
  tenantId: string | null;
  tenantName: string | null;
  role: string | null;
}

/**
 * Resolves the signed-in user and the tenant they act within (via membership).
 * Cached per-request so multiple callers (layout, tRPC context, pages) share
 * one round-trip. RLS lets a user read only their own membership + tenant.
 */
export const getCurrentContext = cache(async (): Promise<CurrentContext> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, tenantId: null, tenantName: null, role: null };

  const { data: membership } = await supabase
    .from("membership")
    .select("role, tenant_id, tenant:tenant_id(name)")
    .limit(1)
    .maybeSingle();

  const tenant = membership?.tenant as { name: string } | { name: string }[] | null | undefined;
  const tenantName = Array.isArray(tenant) ? (tenant[0]?.name ?? null) : (tenant?.name ?? null);

  return {
    user,
    tenantId: membership?.tenant_id ?? null,
    tenantName,
    role: membership?.role ?? null,
  };
});
