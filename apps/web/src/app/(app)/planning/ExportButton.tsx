"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Export completed installs to Excel for a chosen date range. Opens the
 * /api/export route (a real .xlsx download) in a hidden navigation.
 */
export function ExportButton() {
  const t = useTranslations("planning");
  const tc = useTranslations("crud");
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function download() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    window.location.href = `/api/export${qs ? `?${qs}` : ""}`;
    setOpen(false);
  }

  return (
    <div className="export-wrap no-print">
      <button type="button" className="btn-ghost" onClick={() => setOpen((o) => !o)}>
        ⬇ {t("export")}
      </button>
      {open && (
        <div className="export-pop panel" role="dialog" aria-label={t("export")}>
          <p className="help">{t("exportHelp")}</p>
          <label>
            {t("exportFrom")}
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            {t("exportTo")}
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div className="export-actions">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </button>
            <button type="button" className="btn" onClick={download}>
              ⬇ {t("export")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
