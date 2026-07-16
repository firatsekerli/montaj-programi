# Data Model & Rules Engine

Schema sketch (PostgreSQL). Types are indicative; `JSONB attributes` on most
tables holds tenant-specific custom fields validated against a per-type JSON
Schema. All tables carry `tenant_id` (omitted below for brevity) with row-level
security.

## Configuration entities

```sql
-- What a company installs. Dimak: one row per door type.
work_item_type (
  id, code, name, category,
  attribute_schema   jsonb,   -- JSON Schema for order-line attributes (e.g. leaf_width, height)
  capacity_model     text,    -- 'count' | 'effort'
  base_capacity      jsonb,   -- count: {normal: 7, overtime: 10}; effort: {hours_per_unit: f(attrs)}
  attributes         jsonb
)

-- Modifier rules: condition → effect on capacity. The "±%" rules live here.
capacity_rule (
  id, name, enabled, priority int,
  scope        text,   -- 'global' | 'work_item_type' | 'team' | 'order'
  applies_to   jsonb,  -- e.g. {work_item_type_id: ...} or null for global
  condition    jsonb,  -- JSON-logic expr over item/order/team attrs
  effect       jsonb   -- {op:'multiply_capacity', factor:0.8} | {op:'add_units', n:1.5} | {op:'set_shift', hours:12}
)
-- Dimak examples encoded:
--   oversize:    condition (leaf_width>1150 AND height>2400)  effect multiply 0.8
--   demolition:  condition (order.requires_demolition = true) effect multiply 0.5
--   team_of_3:   condition (team.headcount >= 3)              effect add_units 1.5
--   overtime:    condition (day.overtime = true)              effect set_shift 12
```

## People, teams, capability

```sql
person (id, name, is_lead bool, attributes jsonb)

team (
  id, name,
  is_subcontractor bool,
  base_location_id references location,   -- Dimak: the factory
  preference_weight numeric,              -- lower = preferred (in-house beats subcontractor)
  attributes jsonb
)

team_member (team_id, person_id)                 -- headcount derives from this + availability
team_capability (team_id, work_item_type_id)     -- which types a team may install (skills)

availability (                                    -- leave / days off (the "izinli" input)
  id, person_id, date_from, date_to, kind         -- 'leave' | 'partial' | ...
)
```

## Assets (vehicles & equipment)

```sql
location (id, name, geom geography(Point,4326))   -- PostGIS; sites, bases, live asset positions

asset (
  id, name, kind,                 -- 'vehicle' | 'equipment'
  tracks_location bool,           -- the basket must be tracked
  current_location_id references location,
  attributes jsonb
)

asset_capacity (                  -- what/how much an asset can carry
  asset_id, work_item_type_id,    -- open-bed truck → fire door: 15–20
  min_units int, max_units int,
  max_size  jsonb                 -- pickup → industrial ≤ 5 m (2 trips) vs ≤ 7 m
)

asset_dependency (                -- manlift carried in basket; basket attaches to pickup
  asset_id, requires_asset_id, note
)
```

## Sites & orders

```sql
site (
  id, name, location_id references location,
  access_overhead_min int,        -- Roketsan/Aselsan = 120
  attributes jsonb
)

-- named "work_order" (not "order") because ORDER is a reserved SQL keyword.
work_order (
  id, code, site_id,
  order_date date,
  production_ready_date date,      -- default = order_date + tenant.default_leadtime (Dimak: 7 weeks)
  production_confirmed bool,       -- ops marks this after the 2-week check
  requires_demolition bool,
  priority_override int null,
  status text,                    -- 'backlog'|'planned'|'in_progress'|'completed'|'blocked'
  attributes jsonb
)

order_line (
  id, order_id, work_item_type_id,
  quantity int,
  attributes jsonb                -- per-line dims that trigger oversize rule, etc.
)
```

## Plan (the output)

```sql
plan (id, name, date_from, date_to, status)

assignment (
  id, plan_id, date,
  team_id,
  order_id, order_line_id null,   -- whole order or a specific line
  units int,                      -- how many installed this day
  asset_ids uuid[],               -- vehicles/equipment committed
  sequence int,                   -- visit order within the day (for batched jobs)
  estimated_cost numeric,         -- fraction of day budget consumed
  status text                     -- 'planned'|'in_progress'|'completed'
)

task (                            -- system-generated to-dos / notifications
  id, kind, related_order_id,     -- 'production_check' fires 2 weeks before planned install
  due_date, status, assignee_role
)
```

## Tenant settings

```sql
tenant_setting (
  tenant_id,
  default_leadtime_days int,      -- Dimak: 49 (7 weeks)
  normal_shift_hours numeric,     -- 9
  overtime_shift_hours numeric,   -- 12
  production_check_lead_days int, -- 14
  base_location_id references location,
  routing_provider text, ...
)
```

## The rules engine (`/packages/rules`)

Pure functions, no I/O, unit-tested against the spec's own numbers:

```ts
// Given an item, its order, the team, and the day context, return the
// fraction of a team-day this single unit consumes.
function unitCost(ctx: {
  itemType: WorkItemType;
  line: OrderLine;
  order: Order;
  team: Team;
  day: DayContext;         // overtime?, shift hours
  rules: CapacityRule[];
}): number;

// Sum item costs + travel/access for a candidate day and test feasibility.
function isDayFeasible(dayPlan: DayPlan, budget: number): boolean;
```

Rule evaluation: filter `capacity_rule` by scope/`applies_to`, evaluate
`condition` (a small JSON-logic interpreter) against the merged attribute bag,
apply `effect` in `priority` order. Because it is data-in/number-out, we can
lock behavior with fixtures like:

```ts
// From the spec: full-frame single-leaf fire door, normal day → 7/day
expect(dailyCapacity(fullFrameSingle, normalDay)).toBe(7);
// oversized leaf → 20% fewer
expect(dailyCapacity(fullFrameSingle, normalDay, { oversized: true })).toBe(5.6);
// with demolition → 50% fewer
expect(dailyCapacity(fullFrameSingle, normalDay, { demolition: true })).toBe(3.5);
```

These fixtures are the acceptance tests for "we correctly generalized Dimak."
