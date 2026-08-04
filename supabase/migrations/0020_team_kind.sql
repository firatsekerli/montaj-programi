-- ============================================================================
-- Team role: installation crew vs shipping crew.
--
-- 'install'  — a montaj crew: schedulable, shown on the planning board.
-- 'shipping' — a sevkiyat crew: never scheduled to install doors and hidden
--              from the board. Instead each planned install raises a shipment
--              task ("Ferhat, <plaka> ile <kapılar> <tarih> sevk etmeli").
-- ============================================================================

alter table team add column if not exists kind text not null default 'install';
