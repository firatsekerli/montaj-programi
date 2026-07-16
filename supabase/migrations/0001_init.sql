-- ============================================================================
-- Montaj Programı — core schema
-- Universal, config-driven field-installation planner.
-- Everything Dimak-specific (door types, rules, fleet) is DATA, not schema.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists postgis;

-- ---- Enums ------------------------------------------------------------------
create type user_role        as enum ('admin', 'planner', 'ops', 'field');
create type capacity_model   as enum ('count', 'effort');
create type order_status     as enum ('backlog', 'planned', 'in_progress', 'completed', 'blocked');
create type assignment_status as enum ('planned', 'in_progress', 'completed');
create type asset_kind       as enum ('vehicle', 'equipment');
create type task_kind        as enum ('production_check', 'generic');

-- ---- Tenancy ----------------------------------------------------------------
create table tenant (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- App-level user profile, linked to Supabase auth.users.
create table app_user (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- A user's membership + role within a tenant (drives RLS + RBAC).
create table membership (
  tenant_id   uuid not null references tenant (id) on delete cascade,
  user_id     uuid not null references app_user (id) on delete cascade,
  role        user_role not null default 'planner',
  primary key (tenant_id, user_id)
);

create table tenant_setting (
  tenant_id                uuid primary key references tenant (id) on delete cascade,
  default_leadtime_days    int  not null default 49,   -- Dimak: 7 weeks
  normal_shift_hours       numeric not null default 9,
  overtime_shift_hours     numeric not null default 12,
  production_check_lead_days int not null default 14,
  base_location_id         uuid,                        -- FK added after location table
  timezone                 text not null default 'Europe/Istanbul',
  routing_provider         text not null default 'openrouteservice',
  settings                 jsonb not null default '{}'
);

-- ---- Geography --------------------------------------------------------------
create table location (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenant (id) on delete cascade,
  name        text,
  geom        geography(Point, 4326),
  created_at  timestamptz not null default now()
);
create index location_geom_idx on location using gist (geom);
create index location_tenant_idx on location (tenant_id);

alter table tenant_setting
  add constraint tenant_setting_base_location_fk
  foreign key (base_location_id) references location (id) on delete set null;

-- ---- Configuration: what a company installs ---------------------------------
create table work_item_type (
  id               uuid primary key default uuid_generate_v4(),
  tenant_id        uuid not null references tenant (id) on delete cascade,
  code             text not null,
  name             text not null,
  category         text,
  capacity_model   capacity_model not null default 'count',
  base_capacity    jsonb,          -- count model: {"normal":7,"overtime":10}
  effort           jsonb,          -- effort model: {"hoursPerUnit":9}
  attribute_schema jsonb,          -- JSON Schema for order-line custom fields
  attributes       jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  unique (tenant_id, code)
);
create index work_item_type_tenant_idx on work_item_type (tenant_id);

-- Capacity modifier rules: condition -> effect on capacity (the "±%" rules).
create table capacity_rule (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenant (id) on delete cascade,
  name        text not null,
  enabled     boolean not null default true,
  priority    int not null default 100,
  scope       text not null default 'global',   -- global | work_item_type | team | order
  applies_to  jsonb,                             -- e.g. {"work_item_type_id":"..."}
  condition   jsonb,                             -- serialized Condition tree
  effect      jsonb not null,                    -- {"op":"multiply_capacity","factor":0.8}
  created_at  timestamptz not null default now()
);
create index capacity_rule_tenant_idx on capacity_rule (tenant_id);

-- ---- People & teams ---------------------------------------------------------
create table person (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenant (id) on delete cascade,
  name        text not null,
  is_lead     boolean not null default false,
  attributes  jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index person_tenant_idx on person (tenant_id);

create table team (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null references tenant (id) on delete cascade,
  name              text not null,
  is_subcontractor  boolean not null default false,
  base_location_id  uuid references location (id) on delete set null,
  preference_weight numeric not null default 100,  -- lower = preferred (in-house first)
  attributes        jsonb not null default '{}',
  created_at        timestamptz not null default now()
);
create index team_tenant_idx on team (tenant_id);

create table team_member (
  team_id    uuid not null references team (id) on delete cascade,
  person_id  uuid not null references person (id) on delete cascade,
  primary key (team_id, person_id)
);

-- Which work-item types a team is allowed to install (skills).
create table team_capability (
  team_id            uuid not null references team (id) on delete cascade,
  work_item_type_id  uuid not null references work_item_type (id) on delete cascade,
  primary key (team_id, work_item_type_id)
);

-- Leave / partial availability (the "izinli kişi" input).
create table availability (
  id         uuid primary key default uuid_generate_v4(),
  tenant_id  uuid not null references tenant (id) on delete cascade,
  person_id  uuid not null references person (id) on delete cascade,
  date_from  date not null,
  date_to    date not null,
  kind       text not null default 'leave',
  note       text
);
create index availability_person_idx on availability (person_id, date_from, date_to);

-- ---- Assets (vehicles & equipment) -----------------------------------------
create table asset (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid not null references tenant (id) on delete cascade,
  name                text not null,
  kind                asset_kind not null,
  tracks_location     boolean not null default false,   -- the shared basket
  current_location_id uuid references location (id) on delete set null,
  attributes          jsonb not null default '{}',
  created_at          timestamptz not null default now()
);
create index asset_tenant_idx on asset (tenant_id);

create table asset_capacity (
  asset_id           uuid not null references asset (id) on delete cascade,
  work_item_type_id  uuid not null references work_item_type (id) on delete cascade,
  min_units          int,
  max_units          int,
  max_size           jsonb,   -- e.g. {"max_length_m":5}
  primary key (asset_id, work_item_type_id)
);

-- manlift carried in basket; basket attaches to a specific pickup, etc.
create table asset_dependency (
  asset_id          uuid not null references asset (id) on delete cascade,
  requires_asset_id uuid not null references asset (id) on delete cascade,
  note              text,
  primary key (asset_id, requires_asset_id)
);

-- ---- Sites & orders ---------------------------------------------------------
create table site (
  id                 uuid primary key default uuid_generate_v4(),
  tenant_id          uuid not null references tenant (id) on delete cascade,
  name               text not null,
  location_id        uuid references location (id) on delete set null,
  access_overhead_min int not null default 0,   -- Roketsan/Aselsan = 120
  attributes         jsonb not null default '{}',
  created_at         timestamptz not null default now()
);
create index site_tenant_idx on site (tenant_id);

create table "order" (
  id                    uuid primary key default uuid_generate_v4(),
  tenant_id             uuid not null references tenant (id) on delete cascade,
  code                  text not null,
  site_id               uuid not null references site (id),
  order_date            date not null,
  production_ready_date date,                 -- default computed as order_date + leadtime
  production_confirmed  boolean not null default false,
  requires_demolition   boolean not null default false,
  priority_override     int,
  status                order_status not null default 'backlog',
  attributes            jsonb not null default '{}',
  created_at            timestamptz not null default now(),
  unique (tenant_id, code)
);
create index order_tenant_idx on "order" (tenant_id);
create index order_priority_idx on "order" (tenant_id, order_date);

create table order_line (
  id                 uuid primary key default uuid_generate_v4(),
  tenant_id          uuid not null references tenant (id) on delete cascade,
  order_id           uuid not null references "order" (id) on delete cascade,
  work_item_type_id  uuid not null references work_item_type (id),
  quantity           int not null check (quantity > 0),
  attributes         jsonb not null default '{}'
);
create index order_line_order_idx on order_line (order_id);

-- ---- Plan (the output) ------------------------------------------------------
create table plan (
  id         uuid primary key default uuid_generate_v4(),
  tenant_id  uuid not null references tenant (id) on delete cascade,
  name       text,
  date_from  date not null,
  date_to    date not null,
  status     text not null default 'draft',
  created_at timestamptz not null default now()
);
create index plan_tenant_idx on plan (tenant_id);

create table assignment (
  id             uuid primary key default uuid_generate_v4(),
  tenant_id      uuid not null references tenant (id) on delete cascade,
  plan_id        uuid not null references plan (id) on delete cascade,
  assign_date    date not null,
  team_id        uuid not null references team (id),
  order_id       uuid not null references "order" (id),
  order_line_id  uuid references order_line (id),
  units          int not null default 0,
  asset_ids      uuid[] not null default '{}',
  sequence       int not null default 0,
  estimated_cost numeric,          -- fraction of day budget consumed
  status         assignment_status not null default 'planned',
  created_at     timestamptz not null default now()
);
create index assignment_plan_idx on assignment (plan_id, assign_date, team_id);

-- ---- Tasks / notifications --------------------------------------------------
create table task (
  id               uuid primary key default uuid_generate_v4(),
  tenant_id        uuid not null references tenant (id) on delete cascade,
  kind             task_kind not null default 'generic',
  related_order_id uuid references "order" (id) on delete cascade,
  due_date         date,
  assignee_role    user_role,
  status           text not null default 'open',
  payload          jsonb not null default '{}',
  created_at       timestamptz not null default now()
);
create index task_tenant_idx on task (tenant_id, status);
