-- ============================================================================
-- Audit log — who changed what, and when.
--
-- Application-level: server actions append a row (user + action + label). Rows
-- are tenant-scoped and append-only (clients get select + insert, no update or
-- delete). user_name is denormalised so history survives even if the user or the
-- referenced entity is later removed.
-- ============================================================================

create table audit_log (
  id         uuid primary key default uuid_generate_v4(),
  tenant_id  uuid not null references tenant (id) on delete cascade,
  user_id    uuid references app_user (id) on delete set null,
  user_name  text,
  action     text not null,          -- e.g. 'order.update', 'assignment.record'
  entity     text,                   -- 'order' | 'assignment' | 'plan'
  entity_id  uuid,
  label      text,                   -- human label, e.g. the order code
  details    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_tenant_idx on audit_log (tenant_id, created_at desc);

alter table audit_log enable row level security;
create policy audit_isolation on audit_log
  using (tenant_id in (select auth_tenant_ids()))
  with check (tenant_id in (select auth_tenant_ids()));

-- Append-only for clients: select + insert, never update/delete.
grant select, insert on audit_log to authenticated;
