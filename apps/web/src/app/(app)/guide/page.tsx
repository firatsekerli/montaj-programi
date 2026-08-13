import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Kullanma Kılavuzu (user guide). For now this only lists every left-menu
 * section as an outline — the detailed per-section content will be filled in
 * later. Each item links to the section it documents.
 */
export default async function GuidePage() {
  const t = await getTranslations("guide");
  const nav = await getTranslations("nav");

  // Same order as the sidebar menu.
  const items = [
    { href: "/", key: "dashboard" },
    { href: "/planning", key: "planning" },
    { href: "/notifications", key: "notifications" },
    { href: "/orders", key: "orders" },
    { href: "/work-item-types", key: "workItemTypes" },
    { href: "/rules", key: "rules" },
    { href: "/teams", key: "teams" },
    { href: "/people", key: "people" },
    { href: "/assets", key: "assets" },
    { href: "/audit", key: "audit" },
  ] as const;

  return (
    <main>
      <h1>{t("title")}</h1>
      <p className="subtitle">{t("subtitle")}</p>
      <div className="panel">
        <p className="note">{t("intro")}</p>
        <ol className="guide-index">
          {items.map((it) => (
            <li key={it.href}>
              <Link href={it.href}>{nav(it.key)}</Link>
              <span className="guide-soon">{t("comingSoon")}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
