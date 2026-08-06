"use client";

import { useTranslations } from "next-intl";

/** Prints the current page (A4 landscape via the print stylesheet). */
export function PrintButton() {
  const tc = useTranslations("crud");
  return (
    <button type="button" className="btn-ghost no-print" onClick={() => window.print()}>
      🖨 {tc("print")}
    </button>
  );
}
