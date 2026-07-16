/**
 * Supabase types an embedded to-one relationship as an array, though at runtime
 * a foreign-key embed returns a single object (or null). This normalizes both
 * shapes to a single value so call sites can read `.name` etc. safely.
 */
export function one<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}
