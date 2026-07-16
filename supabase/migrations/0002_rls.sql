-- ============================================================================
-- Row-Level Security: strict multi-tenant isolation.
-- A user can only ever read/write rows whose tenant_id is one they belong to.
-- A single-org deployment simply has one tenant — same policies, no code diff.
-- ============================================================================

-- Helper: the set of tenant ids the current auth user belongs to.
create or replace function auth_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from membership where user_id = auth.uid();
$$;

-- Helper: does the current user have one of the given roles in a tenant?
create or replace function auth_has_role(target_tenant uuid, roles user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from membership
    where user_id = auth.uid()
      and tenant_id = target_tenant
      and role = any (roles)
  );
$$;

-- Enable RLS + a standard tenant-scoped policy on every tenant-owned table.
do $$
declare
  t text;
  tenant_tables text[] := array[
    'tenant_setting', 'location', 'work_item_type', 'capacity_rule',
    'person', 'team', 'availability', 'asset', 'site', 'order',
    'order_line', 'plan', 'assignment', 'task'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
    -- Read/write limited to the user's tenants. Finer per-role write rules can
    -- be layered on top per table (see order/assignment below).
    execute format($f$
      create policy tenant_isolation on %I
        using (tenant_id in (select auth_tenant_ids()))
        with check (tenant_id in (select auth_tenant_ids()));
    $f$, t);
  end loop;
end $$;

-- membership / tenant / app_user need their own policies (no plain tenant_id).
alter table tenant enable row level security;
alter table tenant force row level security;
create policy tenant_read on tenant
  for select using (id in (select auth_tenant_ids()));

alter table membership enable row level security;
alter table membership force row level security;
create policy membership_self_read on membership
  for select using (user_id = auth.uid() or tenant_id in (select auth_tenant_ids()));
-- Only tenant admins may change memberships.
create policy membership_admin_write on membership
  for all
  using (auth_has_role(tenant_id, array['admin']::user_role[]))
  with check (auth_has_role(tenant_id, array['admin']::user_role[]));

alter table app_user enable row level security;
alter table app_user force row level security;
create policy app_user_self on app_user
  for all using (id = auth.uid()) with check (id = auth.uid());

-- join tables (team_member, team_capability, asset_capacity, asset_dependency)
-- inherit isolation via their parent rows; enable RLS and gate through the
-- parent's tenant.
alter table team_member enable row level security;
alter table team_member force row level security;
create policy team_member_isolation on team_member
  using (exists (select 1 from team where team.id = team_member.team_id
                 and team.tenant_id in (select auth_tenant_ids())))
  with check (exists (select 1 from team where team.id = team_member.team_id
                 and team.tenant_id in (select auth_tenant_ids())));

alter table team_capability enable row level security;
alter table team_capability force row level security;
create policy team_capability_isolation on team_capability
  using (exists (select 1 from team where team.id = team_capability.team_id
                 and team.tenant_id in (select auth_tenant_ids())))
  with check (exists (select 1 from team where team.id = team_capability.team_id
                 and team.tenant_id in (select auth_tenant_ids())));

alter table asset_capacity enable row level security;
alter table asset_capacity force row level security;
create policy asset_capacity_isolation on asset_capacity
  using (exists (select 1 from asset where asset.id = asset_capacity.asset_id
                 and asset.tenant_id in (select auth_tenant_ids())))
  with check (exists (select 1 from asset where asset.id = asset_capacity.asset_id
                 and asset.tenant_id in (select auth_tenant_ids())));

alter table asset_dependency enable row level security;
alter table asset_dependency force row level security;
create policy asset_dependency_isolation on asset_dependency
  using (exists (select 1 from asset where asset.id = asset_dependency.asset_id
                 and asset.tenant_id in (select auth_tenant_ids())))
  with check (exists (select 1 from asset where asset.id = asset_dependency.asset_id
                 and asset.tenant_id in (select auth_tenant_ids())));
