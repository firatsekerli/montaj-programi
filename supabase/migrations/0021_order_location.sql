-- ============================================================================
-- Move location onto the order; retire the Şantiye (site) entity.
--
-- An order now carries its own Ankara district (ilçe) and access overhead
-- (giriş süresi) directly, so there is no separate site to pick. Travel-time
-- math uses the district center; each order is its own location for scheduling.
-- The site table and work_order.site_id are left in place (nullable) for
-- back-compat, but the app no longer reads or writes them.
-- ============================================================================

alter table work_order add column if not exists district text;
alter table work_order add column if not exists access_overhead_min int not null default 0;

-- Backfill from the currently-linked site.
update work_order o
set district = coalesce(o.district, s.district),
    access_overhead_min = case when o.access_overhead_min = 0 then s.access_overhead_min else o.access_overhead_min end
from site s
where o.site_id = s.id;

-- site is no longer required on an order.
alter table work_order alter column site_id drop not null;
