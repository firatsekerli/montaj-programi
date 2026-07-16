import { initTRPC } from "@trpc/server";
import superjson from "superjson";

/**
 * Request context. In later milestones this resolves the Supabase user and the
 * tenant they act within, so procedures are automatically tenant-scoped. For
 * M0 it is intentionally minimal.
 */
export interface Context {
  tenantId: string | null;
  userId: string | null;
}

export async function createContext(): Promise<Context> {
  // TODO(M0/M1): read Supabase session + membership to fill these in.
  return { tenantId: null, userId: null };
}

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
