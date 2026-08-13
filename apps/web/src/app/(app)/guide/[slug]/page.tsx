import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GUIDE_SECTIONS } from "../sections";
import { GUIDE_CONTENT } from "../content";

export default async function GuideSectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const section = GUIDE_SECTIONS.find((s) => s.slug === slug);
  const Content = GUIDE_CONTENT[slug];
  if (!section || !Content) notFound();

  const t = await getTranslations("guide");
  const nav = await getTranslations("nav");

  return (
    <main>
      <p className="guide-back">
        <Link href="/guide">← {t("title")}</Link>
      </p>
      <h1>{nav(section.navKey)}</h1>
      <div className="panel">
        <Content />
        <p className="guide-golive">
          <Link href={section.live}>{t("openSection", { name: nav(section.navKey) })}</Link>
        </p>
      </div>
    </main>
  );
}
