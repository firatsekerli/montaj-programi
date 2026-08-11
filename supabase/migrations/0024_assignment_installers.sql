-- ============================================================================
-- Who actually installed a completed card.
--
-- Optional list of people (person ids). Empty = the assigned team installed it;
-- a non-empty list records that a different set of people did the work. Recorded
-- when the operator enters the installed count.
-- ============================================================================

alter table assignment add column if not exists installer_ids uuid[] not null default '{}';
