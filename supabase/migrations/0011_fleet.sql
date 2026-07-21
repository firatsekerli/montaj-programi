-- ============================================================================
-- Fleet enforcement in the scheduler.
--
-- Three data points let the planner respect the physical fleet:
--   1. asset.team_id      — the vehicle(s) a team drives. Committed on every
--                           assignment (assignment.asset_ids) and used, together
--                           with asset_capacity.max_units, to cap a team's
--                           units/day of a type to what its truck can carry.
--   2. asset.resource_kind — marks an asset as part of a shared resource POOL of
--                           that kind (e.g. "manlift"). The pool size limits how
--                           many teams can install a resource-requiring type on
--                           the same day.
--   3. work_item_type.required_resource — the resource kind a type needs (e.g.
--                           industrial doors need a "manlift"). Matches the pool
--                           declared by asset.resource_kind above.
--
-- Carrying capacity itself reuses the existing asset_capacity.max_units (0001):
-- the max units of a type a vehicle carries in one day.
-- ============================================================================

alter table asset add column if not exists team_id uuid references team (id) on delete set null;
alter table asset add column if not exists resource_kind text;
create index if not exists asset_team_idx on asset (team_id);

alter table work_item_type add column if not exists required_resource text;
