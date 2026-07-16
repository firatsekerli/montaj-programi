/**
 * Supabase types an embedded to-one relationship as an array, though at runtime
 * a foreign-key embed returns a single object (or null). This normalizes both
 * shapes to a single typed value so call sites can read `.name` etc. safely.
 * Accepts `unknown` because nested embeds often surface as `unknown`.
 */
export function one<T>(rel: unknown): T | null {
  if (Array.isArray(rel)) return (rel[0] ?? null) as T | null;
  return (rel ?? null) as T | null;
}
