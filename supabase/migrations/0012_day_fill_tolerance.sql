-- ============================================================================
-- Overpack tolerance: how far a single team-day may exceed a nominal full day.
--
-- A full day is 1.0. With a tolerance of 0.10 the scheduler may pack a day up
-- to 110%, so travel plus one more unit fits instead of spilling to the next
-- day (e.g. 5 fire doors + a short round trip = 102.8% now fits). Set to 0 for
-- strict 100% days.
-- ============================================================================

alter table tenant_setting
  add column if not exists day_fill_tolerance numeric not null default 0.10;
