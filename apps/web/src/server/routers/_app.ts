import { publicProcedure, router } from "../trpc";
import { capacityRouter } from "./capacity";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, service: "montaj-web" })),
  capacity: capacityRouter,
});

export type AppRouter = typeof appRouter;
