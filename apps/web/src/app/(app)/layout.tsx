import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentContext, getSessionUser } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { NavLinks } from "./NavLinks";

/**
 * Resolves the tenant name off the critical path. Rendered inside <Suspense> so
 * its DB round-trip streams into the sidebar without blocking the page content.
 */
async function TenantName() {
  const { tenantName, userName } = await getCurrentContext();
  return (
    <span className="tenant">
      {tenantName ?? "—"}
      {userName && <span className="brand-user"> · {userName}</span>}
    </span>
  );
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Auth gate uses the local session only (no DB query), so navigation isn't
  // blocked on the membership lookup.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const t = await getTranslations("nav");

  const links = [
    { href: "/", label: t("dashboard") },
    { href: "/planning", label: t("planning") },
    { href: "/notifications", label: t("notifications") },
    { href: "/orders", label: t("orders") },
    { href: "/work-item-types", label: t("workItemTypes") },
    { href: "/rules", label: t("rules") },
    { href: "/teams", label: t("teams") },
    { href: "/people", label: t("people") },
    { href: "/assets", label: t("assets") },
    { href: "/audit", label: t("audit") },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>Montaj Programı</strong>
          <Suspense fallback={<span className="tenant">…</span>}>
            <TenantName />
          </Suspense>
        </div>
        <NavLinks guideLabel={t("guide")} links={links} />
        <form action={signOut} className="signout">
          <button type="submit">{t("signOut")}</button>
        </form>
      </aside>
      <div className="content">{children}</div>
    </div>
  );
}
