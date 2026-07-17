-- ============================================================================
-- Site coordinates enterable in the UI, and lat/lon on locations for the team
-- base — so travel (including intra-day site-to-site) is computed from real
-- coordinates instead of only the seeded PostGIS geometry.
-- ============================================================================

alter table location add column if not exists lat double precision;
alter table location add column if not exists lon double precision;
alter table site add column if not exists lat double precision;
alter table site add column if not exists lon double precision;

-- Backfill location lat/lon from any existing PostGIS geometry.
update location
  set lat = st_y(geom::geometry), lon = st_x(geom::geometry)
  where geom is not null and lat is null;

-- Backfill site lat/lon from its linked location.
update site s
  set lat = l.lat, lon = l.lon
  from location l
  where s.location_id = l.id and s.lat is null and l.lat is not null;
