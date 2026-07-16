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

## Recommended stack (free-tier / serverless)

We keep the **TypeScript full-stack** decision, but shape it to run entirely on
free managed services (Vercel + Supabase). The main change from a classic setup:
**there is no separate always-on NestJS server** — the API lives inside Next.js
route handlers, which deploy as serverless functions on Vercel. Same language,
same shared types, one deploy, zero server to run.

| Layer | Choice (free tier) | Why |
|-------|--------------------|-----|
| **Hosting / frontend** | **Vercel** (Hobby) — Next.js (React, App Router) + PWA | Free hosting, preview deploys, cron, edge. One repo, one deploy. |
| **API** | **Next.js Route Handlers + tRPC + Zod** | Serverless-friendly; typed end-to-end; replaces the separate NestJS server. Structure via a service layer + the `packages/rules` engine. |
| **Database + Auth + Realtime** | **Supabase** (free) — PostgreSQL 15 + **PostGIS**, Auth, Row-Level Security, Realtime, Storage | Covers DB, login, multi-tenant isolation, and live board updates in one free tier. PostGIS is available as an extension. |
| **ORM / migrations** | **Drizzle ORM** (serverless-friendly) or Prisma | Drizzle is lighter and edge/serverless-friendly; either works. Use Supabase's **pooled** connection string (Supavisor) from serverless. |
| **Scheduled jobs** | **Vercel Cron** + Supabase **`pg_cron`** / Edge Functions | The "2-weeks-before production check" is a daily cron — no always-on worker needed. Upstash QStash (free) if we later need a real queue. |
| **Routing / travel time** | **OpenRouteService** free API (matrix + directions), behind an interface | Genuinely free tier, no server to host. Swap to Mapbox/self-hosted OSRM later without touching callers. |
| **Planning board** | dnd-kit (drag-drop) + Supabase Realtime | Day/team grid; realtime so multiple planners see live changes. |
| **Maps UI** | MapLibre GL (free, no key) + OpenStreetMap tiles | No vendor lock-in, no billing. |
| **i18n** | **next-intl**, default locale `tr` | All UI strings in message catalogs (see below). |
| **Optimizer (later, optional)** | Python + Google OR-Tools on a separate host (Fly.io / Railway / Modal free tier) | Only if we want fully-automatic scheduling; kept off the free serverless path and behind the `Scheduler` interface. |

### Supabase vs. Neon

Both are free Postgres. **Supabase is the recommendation** because this app needs
**Auth + Row-Level Security (multi-tenant) + Realtime (live board) + cron**, and
Supabase bundles all of them free. **Neon** is an excellent DB (great serverless
autoscaling and branching) but is DB-only — choosing it means adding Auth.js +
Upstash + Vercel Cron separately. Pick Neon only if you specifically want its
branching workflow and don't mind wiring auth/realtime yourself.

### Free-tier caveats (be aware, not blockers)

- **Vercel Hobby** is intended for non-commercial use; fine for building and
  piloting. A production deployment for a real business (Dimak) may need Vercel
  **Pro**, or self-hosting Next.js on a container host.
- **Supabase free** pauses a project after ~1 week of inactivity and caps DB
  size (~500 MB) and egress. Great for dev/MVP/pilot; production likely wants
  the paid tier eventually.
- Everything above stays **behind interfaces** (DB client, routing, jobs), so
  moving a piece to a paid/self-hosted option later is a config change, not a
  rewrite.

### Why fold the API into Next.js instead of keeping NestJS?

NestJS is designed as a long-running server; on Vercel's serverless model it
runs awkwardly (cold starts, it wants to own the process). Route handlers +
tRPC give the same typed API with zero servers to manage and a truly free
deploy. If you later prefer NestJS's module structure, it can be split back out
onto a free container host (Render/Railway/Fly) — the frontend won't care. This
fork is noted in `docs/open-questions.md`.

## Turkish / internationalization

The UI ships in **Turkish** but we do **not** hard-code Turkish strings — that
would fight the "universal" goal and block a future English/other-language
tenant. Instead:

- **next-intl** with `tr` as the default (and only, for now) locale; every
  user-facing string lives in `messages/tr.json`. Adding a language later = add
  a catalog, no code changes.
- **Locale-correct formatting**: dates/numbers via `Intl` with `tr-TR`;
  app timezone **`Europe/Istanbul`**.
- **Turkish casing pitfall**: Turkish has dotted/dotless i (`i/İ`, `ı/I`). Never
  use default `toUpperCase()/toLowerCase()` on user text — use
  `toLocaleUpperCase('tr-TR')` / `toLocaleLowerCase('tr-TR')`. Do case-insensitive
  search/sort in Postgres with a **`tr-TR` collation** (or `citext` + Turkish
  collation) so "İstanbul"/"istanbul" sort and match correctly.
- **Domain data is separate from UI language**: work-item type names, team
  names, etc. are tenant data (already Turkish for Dimak) and are stored as
  entered — only the *application chrome* goes through i18n catalogs.

## System shape

```
┌────────────────────────────────────────────────────────────┐
│  Vercel — Next.js (PWA, Turkish UI via next-intl)            │
│  • Admin: define types, rules, teams, assets, sites          │
│  • Planner: backlog → drag-drop day/team board + map         │
│  • Field: today's jobs, mark complete (mobile)               │
│  • API: tRPC route handlers (serverless functions)           │
│  • Vercel Cron → daily production-readiness check            │
└───────────────┬───────────────────────────┬────────────────┘
                │ pooled Postgres            │ HTTPS
┌───────────────▼─────────────────┐  ┌───────▼────────────────┐
│  Supabase                        │  │ OpenRouteService (free) │
│  • PostgreSQL + PostGIS + JSONB  │  │ → travel/matrix, cached │
│  • Auth + Row-Level Security     │  └─────────────────────────┘
│  • Realtime (live board)         │
│  • pg_cron / Edge Functions      │
└──────────────────────────────────┘
                │ (later, optional)
        ┌───────▼───────────────────┐
        │ Python OR-Tools optimizer │  behind the Scheduler interface
        │ (Fly.io / Railway free)   │
        └───────────────────────────┘
```

## Multi-tenancy

Every table carries `tenant_id`, enforced with Supabase/PostgreSQL **row-level
security** so a query can never leak across tenants. A single-org deployment
simply has one tenant — no code difference.

## Repository layout (proposed)

```
/apps
  /web            → Next.js app: UI + tRPC API route handlers + Vercel Cron
/packages
  /shared         → shared TS types, Zod/JSON-Schema definitions, rule types
  /rules          → the capacity rules engine (pure, testable, no I/O)
/supabase
  /migrations     → SQL migrations (tables, PostGIS, RLS policies, pg_cron)
  /functions      → Edge Functions (if any)
/messages
  tr.json         → Turkish UI strings (next-intl)
/apps/optimizer   → (later) Python OR-Tools service, deployed separately
/docs             → these design documents
```

Monorepo tooling: pnpm workspaces + Turborepo. The **`packages/rules`** engine
is deliberately pure (data in → numbers out) so it is unit-testable against the
exact Dimak examples in the spec as fixtures — independent of Vercel/Supabase.
