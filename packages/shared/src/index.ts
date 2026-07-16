/**
 * Shared, framework-agnostic types and validation schemas used by both the
 * Next.js app (API + UI) and any future service. Zod schemas double as runtime
 * validators and as the source of TypeScript types.
 */
import { z } from "zod";

/** Roles for RBAC. Mirrors the DB enum in supabase/migrations. */
export const UserRole = z.enum(["admin", "planner", "ops", "field"]);
export type UserRole = z.infer<typeof UserRole>;

export const CapacityModel = z.enum(["count", "effort"]);
export type CapacityModel = z.infer<typeof CapacityModel>;

export const OrderStatus = z.enum([
  "backlog",
  "planned",
  "in_progress",
  "completed",
  "blocked",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const AssignmentStatus = z.enum(["planned", "in_progress", "completed"]);
export type AssignmentStatus = z.infer<typeof AssignmentStatus>;

/** A count-model capacity table entry, or effort-model hours. */
export const BaseCapacity = z.object({
  normal: z.number().nonnegative(),
  overtime: z.number().nonnegative(),
});

export const WorkItemTypeInput = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  capacityModel: CapacityModel,
  baseCapacity: BaseCapacity.optional(),
  effort: z.object({ hoursPerUnit: z.number().positive() }).optional(),
  /** JSON Schema describing this type's custom order-line attributes. */
  attributeSchema: z.record(z.unknown()).optional(),
  attributes: z.record(z.unknown()).default({}),
});
export type WorkItemTypeInput = z.infer<typeof WorkItemTypeInput>;

/** Condition + effect shapes mirror @montaj/rules (kept in sync intentionally). */
export const Comparator = z.enum(["==", "!=", ">", ">=", "<", "<="]);

export const RuleEffect = z.discriminatedUnion("op", [
  z.object({ op: z.literal("multiply_capacity"), factor: z.number() }),
  z.object({ op: z.literal("add_units"), n: z.number() }),
  z.object({ op: z.literal("multiply_effort"), factor: z.number() }),
]);
export type RuleEffect = z.infer<typeof RuleEffect>;

export const CapacityRuleInput = z.object({
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(100),
  /** Serialized condition tree; validated structurally at the engine boundary. */
  condition: z.record(z.unknown()).optional(),
  effect: RuleEffect,
});
export type CapacityRuleInput = z.infer<typeof CapacityRuleInput>;

export const OrderInput = z.object({
  code: z.string().min(1),
  siteId: z.string().uuid(),
  orderDate: z.string(), // ISO date
  productionReadyDate: z.string().optional(),
  requiresDemolition: z.boolean().default(false),
  priorityOverride: z.number().int().nullable().default(null),
  attributes: z.record(z.unknown()).default({}),
  lines: z
    .array(
      z.object({
        workItemTypeId: z.string().uuid(),
        quantity: z.number().int().positive(),
        attributes: z.record(z.unknown()).default({}),
      }),
    )
    .min(1),
});
export type OrderInput = z.infer<typeof OrderInput>;

/** Tenant-wide defaults (Dimak: 7-week lead time, 9h/12h shifts). */
export const TenantSettings = z.object({
  defaultLeadtimeDays: z.number().int().default(49),
  normalShiftHours: z.number().positive().default(9),
  overtimeShiftHours: z.number().positive().default(12),
  productionCheckLeadDays: z.number().int().default(14),
  timezone: z.string().default("Europe/Istanbul"),
});
export type TenantSettings = z.infer<typeof TenantSettings>;
