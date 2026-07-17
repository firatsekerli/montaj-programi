-- ============================================================================
-- Delivery-date driven scheduling.
--
-- The real inputs for an order are the order date and the DELIVERY DATE
-- (teslim tarihi = the date installation must be COMPLETED). The
-- production-completion date (= the day installation must start) is CALCULATED
-- backward from the delivery date, and surfaced to operations as a task.
-- ============================================================================

-- Delivery deadline (installation must finish by this date).
alter table work_order add column if not exists delivery_date date;

-- production_ready_date is now the CALCULATED production-due / install-start date
-- (backward from delivery_date), not a forward "order + 7 weeks" default.

-- Calendar + buffer, per tenant.
-- working_days: ISO weekday numbers the teams install on (1 = Mon ... 7 = Sun).
alter table tenant_setting add column if not exists working_days int[] not null default '{1,2,3,4,5}';
-- production must be ready this many working days BEFORE install starts (safety).
alter table tenant_setting add column if not exists production_buffer_days int not null default 2;
