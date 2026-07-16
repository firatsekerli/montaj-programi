# Open Questions / Decisions Needed

These change the design. Current docs assume the **Recommended** option in each;
tell me to switch any of them.

## Resolved
- **Stack:** TypeScript full-stack — confirmed.
- **Hosting:** free managed services — **Vercel + Supabase** (Next.js API folded
  into route handlers; no separate NestJS server). See `docs/architecture.md`.
- **UI language:** **Turkish** via `next-intl` (default locale `tr`), strings in
  catalogs (not hard-coded) so other languages can be added later.

## 1. Scope of "universal"
- **A. Multi-tenant SaaS** — many companies, each configures its own domain in
  isolation. More upfront work (RLS, config UI, onboarding).
- **B. Single-org, config-driven** *(assumed)* — one company, but all domain
  data is editable rather than hard-coded; built multi-tenant-ready so it can
  grow into A later without a rewrite.

## 2. Scheduling automation
- **A. Hybrid: engine suggests, human finalizes** *(assumed)* — fastest to
  trust; handles real-world exceptions.
- **B. Fully automatic optimizer** — OR-Tools solves it; pushes a Python service
  into the critical path from the start.
- **C. Manual board only** — simplest; humans assign everything.

## 3. Platform / users & devices
- **A. Web-first PWA** *(assumed)* — desktop planning + phone completion, one
  codebase.
- **B. Web + native mobile** — better offline field UX, more work.
- **C. Web/desktop only** — office enters completion; no field app yet.

## 4. API shape (new, from the free-tier decision)
- **A. Fold API into Next.js route handlers (tRPC)** *(assumed)* — one Vercel
  deploy, truly free, typed end-to-end.
- **B. Keep a separate NestJS service** on a free container host (Render/
  Railway/Fly) — more structure, more moving parts, hosts sleep on free tiers.

## 5. Database provider (new)
- **A. Supabase** *(assumed)* — bundles Postgres+PostGIS, Auth, RLS, Realtime,
  cron for free; best fit for this app's needs.
- **B. Neon** — excellent serverless Postgres with branching, but DB-only;
  requires wiring Auth.js + Upstash + Vercel Cron separately.

## 6. Routing/travel-time provider
Hosted free API (**OpenRouteService** *(assumed)*, or Mapbox free tier) vs.
self-hosted OSRM/Valhalla (no per-call cost, but needs a server — not free
serverless). Kept behind an interface either way.

## 7. Domain specifics to confirm with the customer (Dimak) — data, not code
- Is the industrial-door effort truly a function of dimensions (m²)? What curve?
- Exact oversize threshold semantics: is it AND (width **and** height) as
  written, or either?
- Do multiple modifiers stack multiplicatively (assumed) or take the max?
- Working days/holidays calendar per team?
- Do subcontractors have hard capacity caps (Faruk = 2/day) modeled as a team
  capacity ceiling? *(Assumed yes.)*

## 8. Auth / SSO
Supabase Auth email+password to start, or SSO (Google/Microsoft) required?
Supabase supports both; affects only configuration.
