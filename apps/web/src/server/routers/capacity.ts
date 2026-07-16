import {
  dailyCapacity,
  unitsThatFit,
  type CapacityRule,
  type ShiftContext,
  type WorkItemType,
} from "@montaj/rules";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";

/**
 * Thin tRPC surface over the pure @montaj/rules engine. In production the type,
 * rules and shift come from the tenant's data (Supabase); here they are passed
 * in so the endpoint is exercisable end-to-end without a DB.
 */
const workItemTypeSchema = z.object({
  id: z.string(),
  code: z.string(),
  capacityModel: z.enum(["count", "effort"]),
  baseCapacity: z.object({ normal: z.number(), overtime: z.number() }).optional(),
  effort: z.object({ hoursPerUnit: z.number() }).optional(),
});

const shiftSchema = z.object({
  overtime: z.boolean(),
  normalShiftHours: z.number().positive(),
  overtimeShiftHours: z.number().positive(),
});

const ruleSchema = z.array(z.record(z.unknown())).default([]);

export const capacityRouter = router({
  daily: publicProcedure
    .input(
      z.object({
        type: workItemTypeSchema,
        shift: shiftSchema,
        rules: ruleSchema,
        facts: z.record(z.unknown()).default({}),
      }),
    )
    .query(({ input }) =>
      dailyCapacity(
        input.type as WorkItemType,
        input.shift as ShiftContext,
        input.rules as unknown as CapacityRule[],
        input.facts,
      ),
    ),

  unitsThatFit: publicProcedure
    .input(
      z.object({
        type: workItemTypeSchema,
        shift: shiftSchema,
        rules: ruleSchema,
        facts: z.record(z.unknown()).default({}),
        overhead: z.object({
          travelHours: z.number().nonnegative(),
          accessOverheadMinutes: z.number().nonnegative(),
        }),
      }),
    )
    .query(({ input }) =>
      unitsThatFit(
        input.type as WorkItemType,
        input.shift as ShiftContext,
        input.rules as unknown as CapacityRule[],
        input.facts,
        input.overhead,
      ),
    ),
});
