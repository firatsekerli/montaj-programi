-- ============================================================================
-- Optional customer contact on an order (name / surname / phone). Not required.
-- ============================================================================

alter table work_order add column if not exists customer_name text;
alter table work_order add column if not exists customer_surname text;
alter table work_order add column if not exists customer_phone text;
