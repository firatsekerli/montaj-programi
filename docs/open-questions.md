# Open Questions / Decisions Needed

These change the design. Current docs assume the **Recommended** option in each;
tell me to switch any of them.

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

## 4. Tech stack
- **A. TypeScript full-stack** *(assumed)* — Next.js + NestJS + Postgres; one
  language, shared types.
- **B. Python backend + TS frontend** — better if auto-optimization is required
  from day one.
- **C. You decide** — chosen from the answers above.

## 5. Routing/travel-time provider
Self-hosted (OSRM/Valhalla — no per-call cost, needs map data + ops) vs. hosted
API (Mapbox/Google — easy, per-call cost, data leaves the building). Affects
`infra` and budget. *Assumed: start with a hosted API for speed, keep the
provider behind an interface to swap to self-hosted.*

## 6. Domain specifics to confirm with the customer (Dimak) — data, not code
- Is the industrial-door effort truly a function of dimensions (m²)? What curve?
- Exact oversize threshold semantics: is it AND (width **and** height) as
  written, or either?
- Do multiple modifiers stack multiplicatively (assumed) or take the max?
- Working days/holidays calendar per team?
- Do subcontractors have hard capacity caps (Faruk = 2/day) modeled as a team
  capacity ceiling? *(Assumed yes.)*

## 7. Auth / SSO
Email+password to start, or SSO (Google/Microsoft/Keycloak) required? Affects
the auth choice in `docs/architecture.md`.
