-- ============================================================================
-- Allow several teams at one site for a type.
--
-- The "one team per site" rule applies per crew. For most door types a site
-- stays single-team (a second team joins only under deadline pressure), but
-- some types — industrial, sectional — can be installed by several teams at the
-- same site in parallel without any deadline pressure. This flag marks those.
-- ============================================================================

alter table work_item_type
  add column if not exists allow_parallel_teams boolean not null default false;
