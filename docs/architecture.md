# Architecture

## Guiding principle: domain data, not domain code

The application logic must never contain the words "door", "fire", or
"industrial". Those are **tenant data**. The code knows only about generic
primitives — work-item types, capacity rules, teams, assets, sites, orders,
plans — and a **rules engine** that interprets tenant-defined rules at runtime.
This is what makes the app universal.

Two mechanisms deliver this:

1. **Config-driven schema** — core relational tables for concepts every install
   business shares, plus a `JSONB attributes` column on each entity for
   company-specific fields. Each work-item type carries a **JSON Schema** that
   validates its own attributes, so custom fields are strongly typed without
   `ALTER TABLE`.
2. **Data-driven rules** — capacity modifiers, priority, and lead-time defaults
   are rows interpreted by the engine, editable in an admin UI.

## Recommended stack

> These are recommendations for the planning phase. See
> `docs/open-questions.md` for the choices that would change them.

| Layer | Choice | Why |
|-------|--------|-----|
| **Language** | TypeScript end-to-end | One language for a UI-heavy planning tool; large hiring pool; shared types (API ↔ UI) via a monorepo |
| **Frontend** | Next.js (React) + TypeScript | SSR for the admin/reporting screens, client-side interactivity for the board; PWA for field phones |
| **Planning board** | dnd-kit (custom drag-drop) or FullCalendar | Day/team grid with drag-to-assign; dnd-kit gives full control |
| **Maps / routing UI** | MapLibre GL + Leaflet fallback | Show sites, routes, travel-time context; no vendor lock-in |
| **Backend** | NestJS (Node/TypeScript) | Structured modules, DI, validation, guards for RBAC; REST + optional GraphQL |
| **Database** | PostgreSQL 16 + **PostGIS** | Relational core + `JSONB` dynamic fields + geo/travel-time in one engine |
| **ORM / migrations** | Prisma (+ raw SQL for PostGIS/JSONB where needed) | Type-safe queries, painless migrations |
| **Async jobs** | BullMQ + Redis | Production-readiness checks, travel-matrix precompute, notifications |
| **Routing / travel time** | OSRM or Valhalla (self-host), or Mapbox/Google Directions | Compute minutes from team base → site; cache in a travel matrix |
| **Auth** | Auth.js / Keycloak (if SSO needed) | Email + role-based access (ops manager, planner, field, admin) |
| **Optimization (later)** | Python microservice using **Google OR-Tools** | Only if/when we want *fully automatic* scheduling; kept out of the main path for MVP |

### Why not Python for the whole backend?

Python + FastAPI is a fine alternative and is **better if we commit to automatic
optimization from day one** (OR-Tools is Python-first). The trade-off is two
languages to maintain and no shared types with the frontend. Recommendation:
start TypeScript-only with a **hybrid seam** — the scheduler lives behind a
clean interface so a Python OR-Tools solver can replace the heuristic later
without touching the rest of the app. Best of both.

## System shape

```
┌────────────────────────────────────────────────────────────┐
│  Next.js frontend (PWA)                                      │
│  • Admin: define types, rules, teams, assets, sites          │
│  • Planner: backlog → drag-drop day/team board + map         │
│  • Field: today's jobs, mark complete (mobile)               │
└───────────────┬────────────────────────────────────────────┘
                │  REST/GraphQL (typed)
┌───────────────▼────────────────────────────────────────────┐
│  NestJS API                                                 │
│  • CRUD for all config entities (multi-tenant scoped)        │
│  • Rules engine (capacity computation)                       │
│  • Scheduler service  ── interface ──►  [heuristic now]      │
│                                          [OR-Tools later]    │
│  • Jobs: production checks, travel precompute, notifications │
└───────┬───────────────────────────┬────────────────────────┘
        │                           │
┌───────▼─────────┐        ┌────────▼──────────┐
│ PostgreSQL      │        │ Routing (OSRM/    │
│ + PostGIS       │        │ Valhalla/Mapbox)  │
│ + JSONB config  │        │ → travel matrix   │
└─────────────────┘        └───────────────────┘
        │
┌───────▼─────────┐
│ Redis + BullMQ  │
└─────────────────┘
```

## Multi-tenancy

Every table carries `tenant_id`; enforced with PostgreSQL **row-level security**
so a query can never leak across tenants. A single-org deployment simply has one
tenant — no code difference. This keeps the "sell it to many companies" door
open without paying full SaaS complexity up front.

## Repository layout (proposed)

```
/apps
  /web        → Next.js frontend
  /api        → NestJS backend
  /optimizer  → (later) Python OR-Tools service
/packages
  /shared     → shared TS types, JSON-Schema definitions, rule types
  /rules      → the capacity rules engine (pure, testable, no I/O)
/docs         → these design documents
/infra        → docker-compose (Postgres+PostGIS, Redis, OSRM), IaC
```

Monorepo tooling: pnpm workspaces + Turborepo. The **`/packages/rules`** engine
is deliberately pure (data in → numbers out) so it is unit-testable against the
exact Dimak examples in the spec as fixtures.
