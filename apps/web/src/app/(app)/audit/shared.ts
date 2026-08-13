// Shared types + constants for the audit history (used by the server action, the
// server page, and the client table). Kept out of the "use server" file because
// those may only export async functions.

export interface AuditFilters {
  /** Exact user display name. */
  user?: string;
  /** Substring match on the order code (label). */
  order?: string;
  /** Installer name present in details.installers. */
  installer?: string;
  /** Exact action key, e.g. "assignment.move". */
  action?: string;
}

export interface AuditRow {
  id: string;
  userName: string | null;
  action: string;
  label: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

/** Rows fetched per page (initial load + each "load more"). */
export const AUDIT_PAGE = 50;

/** Every action key we have a human label for (order matters for the filter). */
export const AUDIT_ACTIONS = [
  "order.create",
  "order.update",
  "order.delete",
  "order.block",
  "order.unblock",
  "assignment.move",
  "assignment.bulk_move",
  "assignment.record",
  "assignment.undo",
  "plan.generate",
  "plan.clear",
] as const;

export const AUDIT_ACTION_SET = new Set<string>(AUDIT_ACTIONS);
