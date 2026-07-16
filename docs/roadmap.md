# Roadmap

Milestones are ordered so that **each one is independently demoable** and the
Dimak dataset is the running acceptance test throughout.

## M0 — Foundations (repo + infra)

- Monorepo (pnpm + Turborepo): `apps/web` (Next.js + tRPC), `packages/shared`,
  `packages/rules`.
- Supabase project (Postgres + PostGIS enabled); Vercel project linked to the
  repo with preview deploys.
- Migrations in `supabase/migrations` for the core entities in
  `docs/data-model.md`; pooled connection wired for serverless.
- Supabase Auth + tenant scaffolding (single tenant to start), RLS policies,
  RBAC roles (admin / planner / ops / field).
- next-intl configured, `tr` default locale, `messages/tr.json` seeded.

**Demo:** log in (Turkish UI), see empty admin, deployed on Vercel.

## M1 — Configuration (make it universal)

- Admin CRUD for: work-item types (+ JSON-Schema attribute editor), capacity
  rules, teams, people, capabilities, assets & capacities, sites, tenant
  settings.
- Seed the **Dimak dataset** entirely through this UI/config — no hard-coding.

**Demo:** a fresh company (Dimak) fully defined as data.

## M2 — Capacity rules engine

- `packages/rules`: pure engine implementing count + effort models and the
  modifier rules.
- Fixtures locking the spec's numbers (7/day, oversize −20%, demolition −50%,
  overtime, team-of-3, travel/access deductions).

**Demo:** "for team X on an overtime day at site Y, capacity = N," proven by
tests.

## M3 — Orders & backlog ✅ (+ full CRUD for all config entities)

- Order/order-line entry; production-ready default (order + 7 weeks); demolition
  flag; **status lifecycle** (backlog→planned→in_progress→completed→blocked)
  editable inline and in the form.
- Backlog view sorted by order date.
- **Gap closed:** create/edit/delete for Sites, People, Teams (with member +
  capability selection), Assets, and Kapı Tipleri — the whole company is now
  editable from the UI, all RLS-scoped.

**Demo:** add a site, a person, a team, a door type, and an order end-to-end.

## M4 — Routing & travel time ✅

- `travel_estimates()` PostGIS function: great-circle distance base→site,
  converted to round-trip minutes; folded into the day budget alongside the
  site access overhead. Behind a swappable interface (OpenRouteService upgrade
  later). Straight-line for now; no external API needed.

**Demo:** a far site eats into the day → fewer units fit (proven in scheduler tests).

## M5 — Scheduler + planning board (the core value) ✅

- Pure heuristic scheduler in `packages/rules` (multi-day split, capability
  match, production-readiness gate, travel/access, in-house preference), with
  unit tests.
- **Planlama** page: generate a weekly plan, then a day × team **drag-drop
  board** (dnd-kit) with per-cell capacity usage bars, over-capacity warnings,
  live cost recompute on move, and week navigation.

**Demo:** backlog → proposed weekly plan; drag a card to another team/day and
watch the usage bars update.

**Not yet (M5.x):** overtime toggle per day, asset commitment on the board,
leave/availability in headcount, and geographic same-day batching of short jobs.

## M6 — Execution & tracking

- Field PWA view: today's jobs, mark complete; ops authoritative completion.
- Asset location tracking (the basket).
- `production_check` tasks/notifications 2 weeks out; BullMQ jobs.

**Demo:** run a week, mark installs done, get production-readiness reminders.

## M7 — Hardening & (optional) auto-optimizer

- Reports (utilization, on-time rate, subcontractor usage).
- Multi-tenant enablement (RLS on, tenant onboarding).
- Optional `apps/optimizer` (OR-Tools) behind the existing `Scheduler`
  interface for one-click automatic planning.

**Demo:** second tenant with totally different products, zero code changes.

---

### Suggested first coding step after sign-off

Stand up **M0 + a thin slice of M1/M2**: the monorepo, Postgres/PostGIS, the
core Prisma schema, and the pure rules engine with the Dimak fixtures. That
proves the universal model end-to-end on real numbers before any UI polish.
