-- ============================================================================
-- Per-order manlift (shared resource) requirement.
--
-- A door type can declare a required resource (industrial → manlift), but not
-- every job actually needs it. This flag, asked at order entry, decides whether
-- THIS order's resource-requiring lines reserve the resource. Default true keeps
-- existing orders behaving as before; unchecking frees those lines from the pool.
-- ============================================================================

alter table work_order
  add column if not exists requires_resource boolean not null default true;
