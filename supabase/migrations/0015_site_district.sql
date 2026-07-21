-- ============================================================================
-- Locate a site by district instead of raw coordinates.
--
-- The planner picks the site's district (Ankara ilçesi) and the app fills lat/lon
-- from the district center — so travel-time math still works, but the user never
-- types coordinates. Team base locations keep their explicit lat/lon.
-- ============================================================================

alter table site add column if not exists district text;
