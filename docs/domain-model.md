# Domain Model — From Dimak to Universal

This document takes every concrete rule in the original Dimak specification and
restates it as a **universal, data-driven concept**. The goal is that Dimak
becomes *one configured instance* of the system, not the system itself.

## 1. The generalization map

| Dimak-specific rule (from the spec) | Universal concept | Where it lives |
|---|---|---|
| Door types: Industrial, Half/Block-frame single-leaf fire, Full-frame single-leaf, Half/Block double-leaf, Full double-leaf | **Work-item types** with a base daily capacity | `work_item_type` rows |
| Rate table (e.g. full-frame single = 7/day, +overtime = 10/day) | **Base capacity** per type, normal vs. overtime | `work_item_type.capacity` |
| Normal day = 9h, overtime day = 12h | **Shift definitions** (available hours) | tenant/team settings |
| −20% installable if leaf width > 1150 mm **and** height > 2400 mm | **Modifier rule**: attribute threshold → capacity factor | `capacity_rule` row |
| −50% if door removal + wall demolition involved | **Modifier rule**: order flag → capacity factor | `capacity_rule` row |
| Industrial door time varies by size (5×5 m = 1 day; 3×3 m = 3 in 2 days) | **Size-driven effort** for a type (per-item effort, not fixed count) | `work_item_type` capacity model = "effort" |
| 3-person team installs 1–2 more | **Team-size modifier** | `capacity_rule` keyed on team headcount |
| Person on leave is an input | **Availability / leave** per person | `availability` rows |
| Kazım→Industrial+Fire, Erkan→Fire, Faruk→Industrial (subcontractor) | **Team ↔ work-item-type capability** (skills) + subcontractor flag | `team_capability`, `team.is_subcontractor` |
| Prefer in-house (Kazım, Murat) before subcontractor (Faruk) | **Assignment preference / cost weighting** | scheduler config |
| Roketsan/Aselsan entry = 2h security | **Site access overhead** (fixed minutes lost per visit) | `site.access_overhead_min` |
| Kırıkkale/Çankırı far; compute from Dimak factory | **Travel time** from a team's base location to the site | routing service + `location` |
| Open-bed trucks carry 15–20 fire doors; pickups carry 3 industrial | **Assets** with per-work-item-type carrying capacity | `asset`, `asset_capacity` |
| Manlift sometimes needed; carried by "Kamyonet"; 2 manlifts, 1 basket; track the basket | **Equipment assets** with dependencies + location tracking | `asset`, `asset_dependency` |
| Priority by order date (earlier = higher) | **Priority function**, default = order date | scheduler config |
| Production must be done; check 2 weeks before install | **Production-readiness gate** + auto-generated check task | `order.production_ready`, `task` |
| Default production-ready date = order date + 7 weeks | **Configurable lead-time default** | tenant setting |
| Sub-day installs grouped by nearby location | **Geographic batching** of short jobs into one day | scheduler step |
| Ops manager marks install complete | **Completion tracking** with role-based action | `assignment.status`, roles |

**Nothing in the left column is code.** It is all rows in tables an admin can
edit. The scheduler reads these rows; it does not know what a "fire door" is.

## 2. Entity glossary

- **Work-item type** — a kind of thing you install (Dimak: a door type). Has a
  base capacity and a **custom-attribute schema** (e.g. fire doors have
  `leaf_width`, `height`; a different company's product has other fields).
- **Capacity rule** — a data row: *condition → effect on capacity*. Modifiers
  like "oversized −20%", "demolition −50%", "3-person +N", "overtime day".
- **Team** — a unit that performs installs. Has members, a base location, a set
  of work-item-type capabilities (skills), and an in-house/subcontractor flag.
- **Person** — a worker. Belongs to teams; has availability/leave.
- **Asset** — a vehicle or piece of equipment. Has carrying capacity (by
  work-item type), optional location tracking, and dependencies on other assets
  (the manlift→basket→pickup chain).
- **Site** — a customer location. Has geo-coordinates and an access overhead.
- **Order** — a customer order: dates (order date, production-ready date),
  priority, status, a site, a demolition flag, and one or more order lines.
- **Order line** — a quantity of one work-item type within an order, with its
  own attributes (e.g. specific dimensions that trigger the oversize rule).
- **Plan / Assignment** — the output: for a given day, which team installs which
  order (or line), using which assets, in what sequence, with an effort
  estimate and a completion status.
- **Task / Notification** — system-generated to-dos, e.g. the 2-weeks-before
  production-readiness check.

## 3. The capacity model (the heart of it)

Two capacity styles must both be supported, because the Dimak spec uses both:

1. **Count-based** (fire doors): "7 full-frame single-leaf per day." An item
   consumes `1 / rate` of a day.
2. **Effort/size-based** (industrial doors): install time scales with size
   (5×5 m = 1 whole day). An item consumes an effort value derived from its
   attributes.

Unify them as: **every item consumes a fraction of a team-day**, and a team-day
has a budget (normal or overtime). For a mixed day:

```
day_budget            = shift_hours (9 normal / 12 overtime), or 1.0 normalized
item_cost(item, team) = base_cost(type)                       // 1/rate for count-based
                        × Π modifier_factor(applicable rules)  // oversize, demolition, team size…
travel_cost(day)      = Σ travel_time + Σ site_access_overhead // consumes the same budget
plan is feasible when: Σ item_cost + travel_cost ≤ day_budget
```

This single formula expresses the whole rate table, all the ±% rules, overtime,
team size, and travel — as data. See `docs/scheduling-engine.md` for detail.
