# Scheduling Engine

The scheduler turns a **backlog of orders** into a **day-by-day, team-by-team
plan**. It runs in a **hybrid** mode: the engine proposes; a human finalizes on
the board. The engine is behind an interface so a fully-automatic OR-Tools
solver can replace the heuristic later without changing callers.

```ts
interface Scheduler {
  propose(input: SchedulerInput): ProposedPlan;   // heuristic now; OR-Tools later
}
```

## Inputs

- Backlog of orders (with lines, sites, dates, demolition flags, production
  status).
- Teams (members, availability, capabilities, base location, preference weight).
- Assets and their capacities/dependencies/current location.
- Capacity rules and tenant settings (shifts, lead times).
- Travel matrix (team base ↔ site minutes), computed by the routing service and
  cached.

## Constraints the plan must respect

1. **Skill match** — team must have `team_capability` for every line's type.
2. **Production readiness** — an order can't be scheduled before its
   `production_ready_date`, and should be flagged if `production_confirmed` is
   still false within the check window.
3. **Day budget** — `Σ unitCost + travel + access ≤ shift budget` (normal or
   overtime) per team per day.
4. **Asset capacity & availability** — items assigned to a day must fit the
   committed vehicles; an asset can't be in two places at once; dependent assets
   (manlift⇒basket⇒pickup) must be co-committed and their location consistent.
5. **Preference** — prefer in-house teams over subcontractors (weight), matching
   "use Kazım/Murat before Faruk."

## Objective (priority)

Default priority = **earliest order date first**, gated by production readiness.
Configurable per tenant. Then:

- **Batch short jobs by geography** — sub-day installs near each other go on the
  same team-day (the spec's grouping rule). Uses PostGIS distance + travel
  matrix to cluster, then fills a day up to budget.
- **Minimize travel / trips** — respect the "pickup needs 2 trips for a 5 m
  door" reality by charging return trips against the day budget.

## Heuristic (MVP algorithm)

Greedy, priority-ordered, capacity-aware — good enough to be useful and easy to
trust/override:

```
1. Order the backlog by (priority_override ?? order_date), skip items whose
   production_ready_date is in the future or unconfirmed within the window.
2. For each order, find eligible teams (skill match), sorted by preference
   weight then travel time from base to site.
3. Try to place the order's lines on the earliest day where:
     - team has remaining budget after existing assignments + travel + access
     - committed assets can carry the units (split across days/trips if not)
     - required equipment (manlift/basket) is free that day
4. Batch: when a placed job is < 1 day, pull in nearby pending short jobs to
   fill the remaining budget.
5. Emit assignments; leave anything unplaceable in the backlog with a reason.
```

## Automatic optimization (later, optional)

If the office wants "just solve it," model it as a **constraint-optimization
problem** (CP-SAT / OR-Tools in the `/apps/optimizer` Python service):

- Decision vars: item → (team, day) and asset → (team, day).
- Hard constraints: skills, production readiness, day budget, asset capacity,
  asset exclusivity, dependency co-location.
- Soft objective: minimize weighted (lateness vs. order date) + travel +
  subcontractor use.

The heuristic's outputs and the solver's outputs use the same `ProposedPlan`
shape, so the UI and everything downstream are unaffected by which one runs.

## Human-in-the-loop board

The proposed plan renders as a **day × team grid** with a map panel:

- Drag an order card to a different team/day → engine **re-validates** that
  cell (budget, skills, assets) and shows violations inline rather than
  silently accepting an infeasible move.
- Overtime is a per-day toggle that raises that day's budget (9h → 12h).
- Marking a person on leave re-runs affected days.
- Field users see only *their* day and tap **Complete** on each job; the ops
  manager retains the authoritative completion mark (per the spec).

## Notifications & tasks

- A daily job creates a **`production_check` task** for every order whose planned
  install is within `production_check_lead_days` (14) and whose
  `production_confirmed` is false — surfacing the spec's "2 weeks before, confirm
  production" requirement.
- Assets that `tracks_location` (the basket) surface their last known
  `current_location` on the board so planners aren't guessing where it is.
