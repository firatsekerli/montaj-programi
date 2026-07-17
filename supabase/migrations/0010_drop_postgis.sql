-- ============================================================================
-- Retire PostGIS. Travel is now computed from plain lat/lon columns + haversine
-- in the app (since 0009), so the geography column, the geo index, the unused
-- travel_estimates() function, and the PostGIS extension itself are no longer
-- needed. Dropping the extension also removes the public.spatial_ref_sys /
-- geometry_columns / geography_columns objects.
--
-- Order matters: remove everything that depends on PostGIS types/functions
-- BEFORE dropping the extension.
-- ============================================================================

drop function if exists public.travel_estimates();
drop index if exists location_geom_idx;
alter table location drop column if exists geom;

-- If this errors with a dependency, it means some other object still uses a
-- PostGIS type; re-run as `drop extension if exists postgis cascade;`.
drop extension if exists postgis;
