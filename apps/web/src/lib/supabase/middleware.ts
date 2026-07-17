import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Refreshes the Supabase auth session on every request and keeps the auth
 * cookies in sync. Must run in middleware so Server Components always see a
 * fresh session. Does not itself redirect — route protection lives in the
 * (app) layout.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // Next prefetches routes on hover/viewport. Those only need the loading
  // skeleton, not a fresh session — skip the auth round-trip so hovering the
  // menu doesn't fire a Supabase Auth request each time.
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch";
  if (isPrefetch) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touch the session so it is refreshed and cookies are rewritten.
  await supabase.auth.getUser();

  return response;
}
