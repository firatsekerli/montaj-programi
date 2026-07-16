-- ============================================================================
-- Seed the Dimak tenant — the original spec, entirely as DATA.
-- Idempotent: does nothing if the Dimak tenant already exists.
--
-- Also drops FORCE row-level security (leaves RLS ENABLED). FORCE makes even
-- the table owner (the postgres role used by the SQL editor and server-side
-- service_role) subject to RLS, which blocks seeding and admin work. Removing
-- FORCE keeps client roles (anon/authenticated) fully restricted by policy,
-- while trusted server-side roles can administer. This is the standard model.
-- ============================================================================

do $$
declare
  t text;
  tbls text[] := array[
    'tenant_setting','location','work_item_type','capacity_rule','person','team',
    'availability','asset','site','work_order','order_line','plan','assignment','task',
    'tenant','membership','app_user','team_member','team_capability',
    'asset_capacity','asset_dependency'
  ];
begin
  foreach t in array tbls loop
    execute format('alter table %I no force row level security;', t);
  end loop;
end $$;

do $$
declare
  v_tenant   uuid := '11111111-1111-1111-1111-111111111111';
  v_factory  uuid;
  v_roketsan uuid;
  v_genel    uuid;
  v_loc_rk   uuid;
  v_loc_gn   uuid;
  -- work-item types
  v_half_single uuid; v_full_single uuid; v_half_double uuid; v_full_double uuid; v_industrial uuid;
  -- people
  v_kazim uuid; v_sezer uuid; v_murat uuid; v_murat2 uuid; v_erkan uuid; v_yakup uuid; v_faruk uuid;
  -- teams
  v_team_kazim uuid; v_team_murat uuid; v_team_erkan uuid; v_team_faruk uuid;
  -- assets
  v_ak1 uuid; v_ak2 uuid; v_ak3 uuid; v_kbuyuk uuid; v_kamyonet uuid;
  v_manlift1 uuid; v_manlift2 uuid; v_sepet uuid;
  -- orders
  v_order1 uuid; v_order2 uuid;
begin
  if exists (select 1 from tenant where id = v_tenant) then
    raise notice 'Dimak tenant already exists — skipping seed.';
    return;
  end if;

  -- Tenant + settings ---------------------------------------------------------
  insert into tenant (id, name) values (v_tenant, 'Dimak');

  insert into location (tenant_id, name, geom)
    values (v_tenant, 'Dimak Fabrika', st_setsrid(st_makepoint(32.85, 39.95), 4326)::geography)
    returning id into v_factory;

  insert into tenant_setting (tenant_id, default_leadtime_days, normal_shift_hours,
    overtime_shift_hours, production_check_lead_days, base_location_id, timezone)
    values (v_tenant, 49, 9, 12, 14, v_factory, 'Europe/Istanbul');

  -- Sites ---------------------------------------------------------------------
  insert into location (tenant_id, name, geom)
    values (v_tenant, 'Roketsan Konum', st_setsrid(st_makepoint(33.23, 39.92), 4326)::geography)
    returning id into v_loc_rk;
  insert into site (tenant_id, name, location_id, access_overhead_min)
    values (v_tenant, 'Roketsan', v_loc_rk, 120) returning id into v_roketsan;

  insert into location (tenant_id, name, geom)
    values (v_tenant, 'Genel Şantiye Konum', st_setsrid(st_makepoint(32.80, 39.92), 4326)::geography)
    returning id into v_loc_gn;
  insert into site (tenant_id, name, location_id, access_overhead_min)
    values (v_tenant, 'Genel Şantiye', v_loc_gn, 0) returning id into v_genel;

  -- Work-item types (the capacity table) -------------------------------------
  insert into work_item_type (tenant_id, code, name, category, capacity_model, base_capacity)
    values (v_tenant, 'YARIM_BLOK_TEK_KANAT', 'Yarım/Blok Kasa Tek Kanat Yangın Kapısı',
            'Yangın', 'count', '{"normal":9,"overtime":12}')
    returning id into v_half_single;
  insert into work_item_type (tenant_id, code, name, category, capacity_model, base_capacity)
    values (v_tenant, 'TAM_KASA_TEK_KANAT', 'Tam Kasa Tek Kanat Yangın Kapısı',
            'Yangın', 'count', '{"normal":7,"overtime":10}')
    returning id into v_full_single;
  insert into work_item_type (tenant_id, code, name, category, capacity_model, base_capacity)
    values (v_tenant, 'YARIM_BLOK_CIFT_KANAT', 'Yarım/Blok Kasa Çift Kanat Yangın Kapısı',
            'Yangın', 'count', '{"normal":6,"overtime":9}')
    returning id into v_half_double;
  insert into work_item_type (tenant_id, code, name, category, capacity_model, base_capacity)
    values (v_tenant, 'TAM_KASA_CIFT_KANAT', 'Tam Kasa Çift Kanat Yangın Kapısı',
            'Yangın', 'count', '{"normal":5,"overtime":8}')
    returning id into v_full_double;
  insert into work_item_type (tenant_id, code, name, category, capacity_model, effort)
    values (v_tenant, 'ENDUSTRIYEL', 'Endüstriyel Kapı', 'Endüstriyel', 'effort',
            '{"hoursPerUnit":9}')
    returning id into v_industrial;

  -- Capacity modifier rules (the "±%" bullet points) --------------------------
  insert into capacity_rule (tenant_id, name, priority, scope, condition, effect) values
    (v_tenant, 'Büyük kanat (-%20)', 10, 'global',
     '{"all":[{"var":"line.leaf_width","op":">","value":1150},{"var":"line.height","op":">","value":2400}]}',
     '{"op":"multiply_capacity","factor":0.8}'),
    (v_tenant, 'Kapı sökme / duvar kırma (-%50)', 20, 'global',
     '{"all":[{"var":"order.requires_demolition","op":"==","value":true}]}',
     '{"op":"multiply_capacity","factor":0.5}'),
    (v_tenant, '3 kişilik ekip (+1.5 adet)', 30, 'global',
     '{"all":[{"var":"team.headcount","op":">=","value":3}]}',
     '{"op":"add_units","n":1.5}');
  insert into capacity_rule (tenant_id, name, priority, scope, applies_to, condition, effect)
    values (v_tenant, 'Küçük endüstriyel kapı (3x3m)', 10, 'work_item_type',
      jsonb_build_object('work_item_type_id', v_industrial),
      '{"all":[{"var":"line.area_m2","op":"<=","value":9}]}',
      '{"op":"multiply_effort","factor":0.6667}');

  -- People --------------------------------------------------------------------
  insert into person (tenant_id, name, is_lead) values (v_tenant, 'Kazım', true) returning id into v_kazim;
  insert into person (tenant_id, name, is_lead) values (v_tenant, 'Sezer', false) returning id into v_sezer;
  insert into person (tenant_id, name, is_lead) values (v_tenant, 'Murat', true) returning id into v_murat;
  insert into person (tenant_id, name, is_lead) values (v_tenant, 'Murat Ekip Üyesi', false) returning id into v_murat2;
  insert into person (tenant_id, name, is_lead) values (v_tenant, 'Erkan', true) returning id into v_erkan;
  insert into person (tenant_id, name, is_lead) values (v_tenant, 'Yakup', false) returning id into v_yakup;
  insert into person (tenant_id, name, is_lead) values (v_tenant, 'Faruk', true) returning id into v_faruk;

  -- Teams ---------------------------------------------------------------------
  insert into team (tenant_id, name, is_subcontractor, base_location_id, preference_weight)
    values (v_tenant, 'Kazım Ekibi', false, v_factory, 10) returning id into v_team_kazim;
  insert into team (tenant_id, name, is_subcontractor, base_location_id, preference_weight)
    values (v_tenant, 'Murat Ekibi', false, v_factory, 10) returning id into v_team_murat;
  insert into team (tenant_id, name, is_subcontractor, base_location_id, preference_weight)
    values (v_tenant, 'Erkan Ekibi', false, v_factory, 10) returning id into v_team_erkan;
  insert into team (tenant_id, name, is_subcontractor, base_location_id, preference_weight)
    values (v_tenant, 'Faruk Ekibi (Taşeron)', true, v_factory, 100) returning id into v_team_faruk;

  insert into team_member (team_id, person_id) values
    (v_team_kazim, v_kazim), (v_team_kazim, v_sezer),
    (v_team_murat, v_murat), (v_team_murat, v_murat2),
    (v_team_erkan, v_erkan), (v_team_erkan, v_yakup),
    (v_team_faruk, v_faruk);

  -- Capabilities: Kazım = industrial + all fire; Murat = industrial;
  -- Erkan = all fire; Faruk = industrial.
  insert into team_capability (team_id, work_item_type_id) values
    (v_team_kazim, v_industrial), (v_team_kazim, v_half_single), (v_team_kazim, v_full_single),
    (v_team_kazim, v_half_double), (v_team_kazim, v_full_double),
    (v_team_murat, v_industrial),
    (v_team_erkan, v_half_single), (v_team_erkan, v_full_single),
    (v_team_erkan, v_half_double), (v_team_erkan, v_full_double),
    (v_team_faruk, v_industrial);

  -- Assets --------------------------------------------------------------------
  insert into asset (tenant_id, name, kind, current_location_id) values
    (v_tenant, 'Açık Kasa 1', 'vehicle', v_factory) returning id into v_ak1;
  insert into asset (tenant_id, name, kind, current_location_id) values
    (v_tenant, 'Açık Kasa 2', 'vehicle', v_factory) returning id into v_ak2;
  insert into asset (tenant_id, name, kind, current_location_id) values
    (v_tenant, 'Açık Kasa 3', 'vehicle', v_factory) returning id into v_ak3;
  insert into asset (tenant_id, name, kind, current_location_id) values
    (v_tenant, 'Kamyonet Büyük', 'vehicle', v_factory) returning id into v_kbuyuk;
  insert into asset (tenant_id, name, kind, current_location_id) values
    (v_tenant, 'Kamyonet', 'vehicle', v_factory) returning id into v_kamyonet;
  insert into asset (tenant_id, name, kind, current_location_id) values
    (v_tenant, 'Manlift 1', 'equipment', v_factory) returning id into v_manlift1;
  insert into asset (tenant_id, name, kind, current_location_id) values
    (v_tenant, 'Manlift 2', 'equipment', v_factory) returning id into v_manlift2;
  insert into asset (tenant_id, name, kind, tracks_location, current_location_id) values
    (v_tenant, 'Sepet', 'equipment', true, v_factory) returning id into v_sepet;

  -- open beds carry 15–20 fire doors; pickups carry industrial by size
  insert into asset_capacity (asset_id, work_item_type_id, min_units, max_units) values
    (v_ak1, v_full_single, 15, 20), (v_ak2, v_full_single, 15, 20), (v_ak3, v_full_single, 15, 20);
  insert into asset_capacity (asset_id, work_item_type_id, min_units, max_units, max_size) values
    (v_kbuyuk, v_industrial, 1, 3, '{"max_length_m":7}'),
    (v_kamyonet, v_industrial, 1, 3, '{"max_length_m":5}');

  -- manlift carried in the basket; basket attaches to the Kamyonet
  insert into asset_dependency (asset_id, requires_asset_id, note) values
    (v_manlift1, v_sepet, 'Manlift sepette taşınır'),
    (v_manlift2, v_sepet, 'Manlift sepette taşınır'),
    (v_sepet, v_kamyonet, 'Sepet Kamyonet''e bağlanır');

  -- A little backlog so the Orders screen has content ------------------------
  insert into work_order (tenant_id, code, site_id, order_date, production_ready_date,
      requires_demolition, status)
    values (v_tenant, 'SIP-1001', v_genel, current_date - 30, current_date - 30 + 49, false, 'backlog')
    returning id into v_order1;
  insert into order_line (tenant_id, order_id, work_item_type_id, quantity)
    values (v_tenant, v_order1, v_full_single, 12);

  insert into work_order (tenant_id, code, site_id, order_date, production_ready_date,
      requires_demolition, status)
    values (v_tenant, 'SIP-1002', v_roketsan, current_date - 20, current_date - 20 + 49, true, 'backlog')
    returning id into v_order2;
  insert into order_line (tenant_id, order_id, work_item_type_id, quantity, attributes)
    values (v_tenant, v_order2, v_industrial, 2, '{"area_m2":25}');
  insert into order_line (tenant_id, order_id, work_item_type_id, quantity)
    values (v_tenant, v_order2, v_half_single, 6);

  raise notice 'Dimak tenant seeded.';
end $$;
