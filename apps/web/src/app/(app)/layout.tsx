import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentContext } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, tenantName } = await getCurrentContext();
  if (!user) redirect("/login");

  const t = await getTranslations("nav");

  const links = [
    { href: "/", label: t("dashboard") },
    { href: "/orders", label: t("orders") },
    { href: "/work-item-types", label: t("workItemTypes") },
    { href: "/teams", label: t("teams") },
    { href: "/assets", label: t("assets") },
    { href: "/sites", label: t("sites") },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>Montaj Programı</strong>
          <span className="tenant">{tenantName ?? "—"}</span>
        </div>
        <nav>
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="signout">
          <button type="submit">{t("signOut")}</button>
        </form>
      </aside>
      <div className="content">{children}</div>
    </div>
  );
}
