-- ============================================================================
-- Per-team daily capacity override (e.g. a subcontractor's fixed "2/day"), and
-- leave already lives in the `availability` table (0001). This migration adds
-- the optional per-team, per-type units/day override to team_capability.
-- ============================================================================

alter table team_capability add column if not exists daily_cap int;
