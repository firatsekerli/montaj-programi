"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateAssetLocation } from "@/app/actions/assets";

interface LocationOption {
  id: string;
  name: string | null;
}

/**
 * Location <select> that doubles as a live updater. In the editor for an
 * existing asset (assetId set), changing it saves immediately via a server
 * action and shows a "saved" flash — no full-form submit needed. It also keeps
 * the value under the `current_location_id` form field, so creating a new asset
 * (no assetId) still persists the choice on submit.
 */
export function AssetLocationField({
  assetId,
  locations,
  defaultLocationId,
  live = true,
}: {
  assetId?: string;
  locations: LocationOption[];
  defaultLocationId?: string | null;
  live?: boolean;
}) {
  const t = useTranslations("assets");
  const [value, setValue] = useState(defaultLocationId ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    setValue(next);
    setSaved(false);
    if (!live || !assetId) return;
    startTransition(async () => {
      await updateAssetLocation(assetId, next);
      setSaved(true);
    });
  }

  return (
    <span className="live-loc">
      <select
        name="current_location_id"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name ?? l.id}
          </option>
        ))}
      </select>
      {live && assetId && (
        <span className="live-loc-status" aria-live="polite">
          {pending ? t("saving") : saved ? t("saved") : ""}
        </span>
      )}
    </span>
  );
}
