-- ============================================================================
-- Store the scheduler's "could not place" list on the plan, so the board can
-- explain WHY a backlog item isn't on the grid (not produced yet, no capable
-- team, or the week ran out of capacity) instead of just showing nothing.
-- ============================================================================

alter table plan add column if not exists unplaced jsonb not null default '[]';
