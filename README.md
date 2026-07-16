# Montaj Programı — Universal Field-Installation Planner

A capacity-planning and scheduling system for **make-then-install** businesses:
companies that manufacture items and then send teams into the field to install
them. The original requirements come from **Dimak** (a door manufacturer that
installs industrial and fire doors), but the product is designed to be
**universal** — every domain-specific detail (product types, capacity rules,
teams, fleet, lead times) is **configuration and data**, not hard-coded logic.

> A new company should be able to onboard by defining *what they install*, *who
> installs it*, *what they carry it in*, and *the rules that govern how fast* —
> without any code changes.

## The problem, in one paragraph

Orders arrive with a due/priority date. Each order is produced first, then
installed on-site by a team using vehicles (and sometimes special equipment).
How many items a team can install per day depends on the item type, its size,
whether demolition is involved, team size, overtime, and travel time to the
site. The office needs to turn a backlog of orders into a **day-by-day plan**
that respects team skills, vehicle capacity, equipment availability, production
readiness, and site access constraints — and then track completion.

## Documents

| Doc | Contents |
|-----|----------|
| [`docs/domain-model.md`](docs/domain-model.md) | The Dimak spec generalized into universal concepts + entity glossary |
| [`docs/architecture.md`](docs/architecture.md) | Stack choice, system design, how "everything dynamic" works |
| [`docs/data-model.md`](docs/data-model.md) | Config-driven database schema and the capacity rules engine |
| [`docs/scheduling-engine.md`](docs/scheduling-engine.md) | How capacity is computed and how a plan is produced |
| [`docs/roadmap.md`](docs/roadmap.md) | Milestones from MVP to full product |
| [`docs/open-questions.md`](docs/open-questions.md) | Decisions still needed before/while building |

## Status

**M0 + M1 shipped, live on Vercel + Supabase.** Confirmed stack: **TypeScript
full-stack on free managed services (Vercel + Supabase)**, **Turkish UI** (via
`next-intl`, strings in catalogs). Remaining open choices are in
`docs/open-questions.md`.

What's in the repo now:

- `packages/rules` — the pure capacity engine, with **13 passing tests** that
  reproduce the exact numbers from the Dimak spec (7/day, oversize −20%,
  demolition −50%, overtime, team-of-3, travel/access deductions).
- `packages/shared` — shared Zod schemas/types.
- `apps/web` — Next.js (App Router) in **Turkish**:
  - **Supabase auth** (login, session middleware, route protection).
  - **Tenant-aware tRPC** (context resolves the user's tenant; `me` + capacity API).
  - **Admin screens with full create/edit/delete** for every entity — Kapı
    Tipleri, Siparişler (with line items + status lifecycle), Ekipler (members +
    capabilities), Kişiler, Araçlar, Şantiyeler. Nothing is read-only.
  - Dashboard with live capacity computed from DB rows.
  - Daily production-check cron route.
- `supabase/migrations` — full schema (PostGIS + all core tables), Row-Level
  Security for multi-tenant isolation, the **Dimak seed** (`0003`), and auth
  wiring/grants (`0004`).

### Develop

```bash
pnpm install
pnpm --filter @montaj/rules test     # verify the engine against the Dimak spec
pnpm --filter @montaj/web dev         # run the app (needs .env — see .env.example)
```
