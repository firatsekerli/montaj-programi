-- ============================================================================
-- Travel time inputs. A PostGIS function returns the straight-line distance
-- (meters, great-circle since geom is geography) between each team's base and
-- each site for the caller's tenant. The app converts meters -> minutes with an
-- average speed. Runs as SECURITY INVOKER so RLS scopes it to the user's tenant.
--
-- This is the free, no-external-API travel estimate. A road-network provider
-- (OpenRouteService) can replace the conversion later behind the same shape.
-- ============================================================================

create or replace function public.travel_estimates()
returns table (team_id uuid, site_id uuid, meters double precision)
language sql
stable
security invoker
set search_path = public
as $$
  select t.id as team_id,
         s.id as site_id,
         st_distance(bl.geom, sl.geom) as meters
  from team t
  join location bl on bl.id = t.base_location_id
  cross join site s
  join location sl on sl.id = s.location_id
  where t.tenant_id in (select auth_tenant_ids())
    and s.tenant_id = t.tenant_id;
$$;

grant execute on function public.travel_estimates() to authenticated;
