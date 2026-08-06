-- ============================================================================
-- Provision the five Dimak users (no roles — everyone is admin / full access).
--
-- The handle_new_user() trigger (0004) fires on each auth.users insert and
-- auto-creates the app_user profile + an 'admin' membership in the Dimak tenant,
-- so we only need to create the auth users here. full_name is taken from
-- raw_user_meta_data and shown in the sidebar. Idempotent by email.
--
-- NOTE: firat@dimakcom.tr in the request looked like a typo (the others are
-- @dimak.com.tr) so it's created as firat@dimak.com.tr. Change that one line if
-- the original was intended.
--
-- If your Supabase version rejects direct auth.users/identities inserts, create
-- the users instead in the Dashboard (Authentication → Users → Add user), and set
-- their full_name under "User Metadata" as {"full_name":"Eda"} — the trigger links
-- them to Dimak automatically.
-- ============================================================================

create extension if not exists pgcrypto;

with new_users(email, pw, name) as (
  values
    ('eda@dimak.com.tr',    '1234', 'Eda'),
    ('omer@dimak.com.tr',   '2345', 'Ömer'),
    ('firat@dimak.com.tr',  '3456', 'Fırat'),
    ('servis@dimak.com.tr', '4567', 'Hatice'),
    ('montaj@dimak.com.tr', '5678', 'Hakan')
),
inserted as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    nu.email,
    crypt(nu.pw, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', nu.name),
    now(),
    now(),
    '', '', '', ''
  from new_users nu
  where not exists (select 1 from auth.users x where x.email = nu.email)
  returning id, email
)
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select i.email, i.id, jsonb_build_object('sub', i.id::text, 'email', i.email), 'email', now(), now(), now()
from inserted i;
