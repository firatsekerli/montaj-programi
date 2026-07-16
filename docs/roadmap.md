# Roadmap

Milestones are ordered so that **each one is independently demoable** and the
Dimak dataset is the running acceptance test throughout.

## M0 — Foundations (repo + infra)

- Monorepo (pnpm + Turborepo): `apps/web`, `apps/api`, `packages/shared`,
  `packages/rules`.
- `infra/docker-compose`: PostgreSQL + PostGIS, Redis.
- Prisma schema for the core entities in `docs/data-model.md`; migrations.
- Auth + tenant scaffolding (single tenant to start), RBAC roles
  (admin / planner / ops / field).

**Demo:** log in, see empty admin.

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

## M3 — Orders & backlog

- Order/order-line entry with custom attributes; production-ready default
  (order + 7 weeks); demolition flag; status lifecycle.
- Backlog view sorted by priority.

**Demo:** load orders, see prioritized backlog.

## M4 — Routing & travel time

- Routing service integration (OSRM/Valhalla or Mapbox), travel-matrix cache,
  site access overhead.
- Map panel showing sites and base.

**Demo:** "Kırıkkale is 90 min from the factory → capacity drops accordingly."

## M5 — Scheduler + planning board (the core value)

- Heuristic scheduler (`docs/scheduling-engine.md`).
- Day × team drag-drop board with live re-validation, overtime toggle,
  geographic batching, asset commitment.

**Demo:** backlog → proposed weekly plan; drag to adjust; violations flagged.

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
