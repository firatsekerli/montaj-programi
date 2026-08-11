-- ============================================================================
-- Per-order notes shown on planning cards.
--
-- Notes attach to the ORDER, not a single assignment/card: an order can be
-- split across many cards (team-days) and cards are regenerated on every
-- re-plan, so an order-scoped note survives re-planning and appears on every
-- card for that order. Multiple notes per order; append-only threads.
-- author_name is denormalised so a note survives its author being removed.
-- ============================================================================

create table order_note (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenant (id) on delete cascade,
  order_id    uuid not null references work_order (id) on delete cascade,
  body        text not null,
  author_id   uuid references app_user (id) on delete set null,
  author_name text,
  created_at  timestamptz not null default now()
);
create index order_note_order_idx on order_note (order_id, created_at);

alter table order_note enable row level security;
create policy order_note_isolation on order_note
  using (tenant_id in (select auth_tenant_ids()))
  with check (tenant_id in (select auth_tenant_ids()));

grant select, insert, delete on order_note to authenticated;
