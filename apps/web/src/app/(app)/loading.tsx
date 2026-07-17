/**
 * Shown instantly on navigation while the server component streams in. Only a
 * header placeholder — no panel skeleton — so the real content panel appears at
 * its natural size instead of collapsing from an over-tall skeleton (which
 * caused a layout shift).
 */
export default function Loading() {
  return (
    <main aria-busy="true">
      <div className="skeleton sk-title" />
      <div className="skeleton sk-sub" />
    </main>
  );
}
