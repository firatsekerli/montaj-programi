/**
 * Shown instantly on navigation while the server component streams in. Turns
 * "the page hangs on the old view" into an immediate skeleton, so navigation
 * feels fast even though each page is server-rendered on demand.
 */
export default function Loading() {
  return (
    <main aria-busy="true">
      <div className="skeleton sk-title" />
      <div className="skeleton sk-sub" />
      <div className="panel">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton sk-row" />
        ))}
      </div>
    </main>
  );
}
