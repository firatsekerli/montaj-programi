import { protectedProcedure, publicProcedure, router } from "../trpc";
import { capacityRouter } from "./capacity";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, service: "montaj-web" })),
  /** Who am I, and which tenant am I acting within. */
  me: protectedProcedure.query(({ ctx }) => ({
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    role: ctx.role,
  })),
  capacity: capacityRouter,
});

export type AppRouter = typeof appRouter;
