import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { GUIDE_SECTIONS } from "./sections";
import { GUIDE_CONTENT } from "./content";

/**
 * Kullanma Kılavuzu (user guide) index — lists every left-menu section. Sections
 * that have been written link to their guide page; the rest show "yakında".
 */
export default async function GuidePage() {
  const t = await getTranslations("guide");
  const nav = await getTranslations("nav");

  return (
    <main>
      <h1>{t("title")}</h1>
      <p className="subtitle">{t("subtitle")}</p>
      <div className="panel">
        <p className="note">{t("intro")}</p>
        <ol className="guide-index">
          {GUIDE_SECTIONS.map((s) => {
            const ready = Boolean(GUIDE_CONTENT[s.slug]);
            return (
              <li key={s.slug}>
                {ready ? (
                  <Link href={`/guide/${s.slug}`}>{nav(s.navKey)}</Link>
                ) : (
                  <span className="guide-pending">{nav(s.navKey)}</span>
                )}
                <span className="guide-soon">{ready ? t("ready") : t("comingSoon")}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}
