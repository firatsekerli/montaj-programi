# Deploy to Vercel + Supabase (free tier)

Goal: see the app live in your browser. ~10 minutes. Nothing here costs money.

> M0 note: the homepage renders the Turkish capacity table directly from the
> rules engine — it does **not** need the database yet. So Vercel alone gets you
> a live page; Supabase is set up now because the next milestone (login + admin)
> uses it.

---

## Part A — Supabase (database)

1. Go to <https://supabase.com> → sign in → **New project**.
   - Name: `montaj-programi` (anything).
   - Region: pick one close to Turkey (e.g. **Frankfurt / eu-central**).
   - Set a database password and save it somewhere.
2. Wait ~2 min for it to provision.
3. **Run the schema.** Left sidebar → **SQL Editor** → **New query**, then:
   - Paste the entire contents of [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) → **Run**.
     - A dialog "Potential issue detected … tables without RLS" appears. This is
       expected — click **Run without RLS**. (The next script turns RLS on with
       the proper policies. Do not use "Run and enable RLS".)
   - New query again → paste [`supabase/migrations/0002_rls.sql`](../supabase/migrations/0002_rls.sql) → **Run**.
     This enables Row-Level Security and adds the tenant-isolation policies.
   - (The first script enables PostGIS itself. If it ever errors, go to
     **Database → Extensions**, enable `postgis`, then re-run.)
4. **Grab your keys.** Left sidebar → **Project Settings → API**. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (secret — server only)
5. (Optional) **Table Editor** should now list `tenant`, `order`, `team`,
   `work_item_type`, etc. — confirmation the schema loaded.

---

## Part B — Vercel (hosting)

1. Go to <https://vercel.com> → sign in with GitHub → **Add New… → Project**.
2. **Import** the repo `firatsekerli/montaj-programi` (authorize Vercel for the
   repo if prompted).
3. **Configure Project** — the only setting that matters for our monorepo:
   - **Root Directory** → click **Edit** → select **`apps/web`**.
     (Vercel auto-detects Next.js and installs the pnpm workspace from the repo
     root — you don't need to change build/install commands.)
4. **Environment Variables** — add these (from Part A):

   | Name | Value | Needed |
   |------|-------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL | now |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key | now |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key | soon (M1) |
   | `CRON_SECRET` | any random string | for the daily cron |
   | `NEXT_PUBLIC_DEFAULT_LOCALE` | `tr` | optional |
   | `NEXT_PUBLIC_APP_TIMEZONE` | `Europe/Istanbul` | optional |

5. **Deploy.**
6. **Production branch:** this repo's only branch right now is
   `claude/montaj-universal-app-planning-kzhdnn`. If Vercel didn't already pick
   it, go to **Project Settings → Git → Production Branch**, set it to that
   branch, and **Redeploy**. (Alternatively, merge the branch into `main` and
   Vercel will deploy `main` as production — your choice.)

---

## Part A2 — Seed data + login (M1)

After `0001` and `0002`, run the remaining migrations and create a login:

1. **SQL Editor** → run [`supabase/migrations/0003_seed_dimak.sql`](../supabase/migrations/0003_seed_dimak.sql)
   (loads the Dimak tenant: door types, rules, teams, fleet, sites, a little backlog).
2. **SQL Editor** → run [`supabase/migrations/0004_auth.sql`](../supabase/migrations/0004_auth.sql)
   (creates the signup→profile trigger, grants, and auto-attaches new users to Dimak as admin).
3. **SQL Editor** → run [`supabase/migrations/0005_travel.sql`](../supabase/migrations/0005_travel.sql)
   (adds the `travel_estimates()` function the planner uses for travel time).
4. **Create your user:** Authentication → **Users → Add user** → enter email + password
   and tick **Auto Confirm User**. The trigger links you to the Dimak tenant automatically.
4. **Recommended:** Authentication → Providers → Email → turn **off** "Allow new users to
   sign up", so only users you create in the dashboard can log in (the auto-attach is a
   single-org convenience until per-tenant invites land).

Then log in at `https://YOUR-APP.vercel.app/login` and you'll land on the dashboard with
the seeded Dimak data. Open **Planlama → Planı Oluştur** to generate a weekly plan and
drag the cards between teams/days.

> Re-running: `0003`/`0004` are safe to re-run (idempotent). `0005` just replaces a
> function. If you seeded before this milestone, run `0005` now.

## Part C — See it

- Open the deployment URL Vercel gives you → the **Turkish homepage** with the
  capacity table computed by the engine (9/12, 7/10, 5/8 …).
- Health check: `https://YOUR-APP.vercel.app/api/trpc/health` → `{"ok":true}`.
- Live capacity via API (overtime full-frame door → `10`):
  `…/api/trpc/capacity.daily?input=%7B%22json%22%3A%7B%22type%22%3A%7B%22id%22%3A%221%22%2C%22code%22%3A%22X%22%2C%22capacityModel%22%3A%22count%22%2C%22baseCapacity%22%3A%7B%22normal%22%3A7%2C%22overtime%22%3A10%7D%7D%2C%22shift%22%3A%7B%22overtime%22%3Atrue%2C%22normalShiftHours%22%3A9%2C%22overtimeShiftHours%22%3A12%7D%2C%22rules%22%3A%5B%5D%2C%22facts%22%3A%7B%7D%7D%7D`

Every push to the branch now auto-deploys a preview; production redeploys on
pushes to the production branch.

---

## Shortcut: Vercel's Supabase integration

Instead of copying keys by hand, in Vercel go to **Integrations → Supabase →
Add integration**, link your project, and it injects the `NEXT_PUBLIC_SUPABASE_*`
env vars for you. You still run the SQL from Part A once.

## Troubleshooting

- **Build fails on `@montaj/rules` / `@montaj/shared` not found** → Root
  Directory must be `apps/web` (not the repo root); Vercel then installs the
  whole workspace. Re-check step B.3.
- **Node version** → Project Settings → General → Node.js Version = **22.x**
  (the repo requires Node ≥ 22).
- **Page loads but API 500s** → a Supabase env var is missing/misspelled; the
  homepage itself doesn't need them, API/DB calls do.
