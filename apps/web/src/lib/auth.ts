import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CurrentContext {
  user: User | null;
  tenantId: string | null;
  tenantName: string | null;
  role: string | null;
  /** Display name of the signed-in user (from metadata, else email). */
  userName: string | null;
}

/** The signed-in user's display name: full_name metadata, else the email local part. */
function displayName(user: User | null): string | null {
  if (!user) return null;
  const full = (user.user_metadata?.full_name as string | undefined)?.trim();
  if (full) return full;
  return user.email ?? null;
}

/**
 * Resolves the signed-in user and the tenant they act within (via membership).
 * Cached per-request so multiple callers (layout, tRPC context, pages) share
 * one round-trip. RLS lets a user read only their own membership + tenant.
 */
/**
 * Just the signed-in user, read from the cookie (local, no network). Use this
 * for the auth gate on every navigation — it must not do a DB round-trip.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
});

export const getCurrentContext = cache(async (): Promise<CurrentContext> => {
  const supabase = await createSupabaseServerClient();
  // Read the session from the cookie (local, no network round-trip). The
  // middleware already validated + refreshed the token for this request, and
  // Row-Level Security is the real gate on every query, so we don't pay for a
  // second getUser() network call on every page navigation.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) return { user: null, tenantId: null, tenantName: null, role: null, userName: null };

  const { data: membership } = await supabase
    .from("membership")
    .select("role, tenant_id, tenant:tenant_id(name), app_user:user_id(full_name)")
    .limit(1)
    .maybeSingle();

  const tenant = membership?.tenant as { name: string } | { name: string }[] | null | undefined;
  const tenantName = Array.isArray(tenant) ? (tenant[0]?.name ?? null) : (tenant?.name ?? null);

  // Prefer the editable app_user.full_name; fall back to auth metadata, then email.
  const appUser = membership?.app_user as { full_name?: string } | { full_name?: string }[] | null | undefined;
  const dbName = (Array.isArray(appUser) ? appUser[0]?.full_name : appUser?.full_name)?.trim();

  return {
    user,
    tenantId: membership?.tenant_id ?? null,
    tenantName,
    role: membership?.role ?? null,
    userName: dbName || displayName(user),
  };
});
