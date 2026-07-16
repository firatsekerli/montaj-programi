import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getCurrentContext } from "@/lib/auth";

/**
 * Request context. Resolves the Supabase user and the tenant they act within,
 * so protected procedures are automatically tenant-scoped.
 */
export interface Context {
  userId: string | null;
  tenantId: string | null;
  role: string | null;
}

export async function createContext(): Promise<Context> {
  const { user, tenantId, role } = await getCurrentContext();
  return { userId: user?.id ?? null, tenantId, role };
}

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires an authenticated user attached to a tenant. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId || !ctx.tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Oturum veya kiracı bulunamadı." });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId, tenantId: ctx.tenantId } });
});
