import { NextResponse } from "next/server";

/**
 * Daily job (wired via vercel.json cron) implementing the spec's rule:
 * "2 weeks before an installation, flag whether production is complete."
 *
 * For each tenant, create a `production_check` task for every order whose
 * planned install falls within `production_check_lead_days` and whose
 * production is not yet confirmed. M0 ships the authenticated entry point; the
 * DB logic lands with the orders milestone (M3/M6).
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // TODO(M6): iterate tenants, upsert production_check tasks via service-role
  // Supabase client. Kept as a no-op stub so the schedule can be verified now.
  const createdTasks = 0;

  return NextResponse.json({ ok: true, createdTasks });
}
