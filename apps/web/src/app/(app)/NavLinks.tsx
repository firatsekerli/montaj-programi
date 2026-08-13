"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

/** Sidebar links with an active state for the current page. */
export function NavLinks({ guideLabel, links }: { guideLabel: string; links: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav>
      <Link href="/guide" className={`guide-link${isActive("/guide") ? " active" : ""}`}>
        {guideLabel}
      </Link>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
