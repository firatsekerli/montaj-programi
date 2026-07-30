-- ============================================================================
-- Idempotent operations tasks.
--
-- Tasks (production-due, manlift transfer, ...) are re-derived from the plan on
-- every "Yeniden Oluştur". A stable dedup_key lets us reconcile them without
-- losing what the operator already ticked off: an existing key is updated, a
-- done key is left alone, and open keys no longer needed are removed.
-- ============================================================================

alter table task add column if not exists dedup_key text;
create index if not exists task_dedup_idx on task (tenant_id, kind, dedup_key);
