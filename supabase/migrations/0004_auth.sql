-- ============================================================================
-- Auth wiring.
-- 1. On Supabase auth signup, create the app_user profile row.
-- 2. Auto-attach the new user to the Dimak tenant as admin.
--    DEV / single-org convenience: keep public sign-ups DISABLED in Supabase
--    (Authentication → Providers → Email → "Allow new users to sign up" off, or
--    just create users in Authentication → Users), so only you provision users.
--    A proper per-tenant invite flow replaces this in a later milestone.
-- 3. Grant the authenticated role table privileges (RLS policies still apply on
--    top of these grants).
-- ============================================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into app_user (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;

  insert into membership (tenant_id, user_id, role)
  values ('11111111-1111-1111-1111-111111111111', new.id, 'admin')
  on conflict (tenant_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Grants: privileges for client roles (RLS narrows what rows they can touch).
grant usage on schema public to anon, authenticated;

do $$
declare
  t text;
  tbls text[] := array[
    'tenant','membership','app_user','tenant_setting','location','work_item_type',
    'capacity_rule','person','team','team_member','team_capability','availability',
    'asset','asset_capacity','asset_dependency','site','work_order','order_line',
    'plan','assignment','task'
  ];
begin
  foreach t in array tbls loop
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
  end loop;
end $$;

-- Back-fill: if you already created auth users before this trigger existed,
-- link them to the Dimak tenant now.
insert into app_user (id, email, full_name)
  select id, email, coalesce(raw_user_meta_data->>'full_name', email)
  from auth.users
  on conflict (id) do nothing;

insert into membership (tenant_id, user_id, role)
  select '11111111-1111-1111-1111-111111111111', id, 'admin'
  from auth.users
  on conflict (tenant_id, user_id) do nothing;
