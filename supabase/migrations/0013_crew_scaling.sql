-- ============================================================================
-- Crew-based capacity scaling.
--
-- A type's base counts (base_capacity) assume a baseline crew — the Dimak spec
-- table is for a 2-person team. Each extra person above that baseline adds
-- `per_person_bonus` units/day (fire doors +2, industrial +1). The engine now
-- computes the daily count from the team's headcount; the per-team günlük adet
-- (team_capability.daily_cap) still overrides it only when explicitly set.
--
-- This replaces the old global "3-person team +1.5" capacity_rule with a
-- per-type bonus, so different door types scale by different amounts.
-- ============================================================================

alter table work_item_type add column if not exists crew_baseline int not null default 2;
alter table work_item_type add column if not exists per_person_bonus numeric not null default 0;
