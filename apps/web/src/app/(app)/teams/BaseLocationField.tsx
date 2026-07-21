"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface Option {
  id: string;
  name: string | null;
}
interface Draft {
  name: string;
  lat: string;
  lon: string;
}

/**
 * Base-location picker: choose an existing location, or add a new one via a
 * modal. A staged new location submits with the team form (new_location_*),
 * which the team action turns into a real location row.
 */
export function BaseLocationField({
  locations,
  defaultLocationId,
}: {
  locations: Option[];
  defaultLocationId?: string | null;
}) {
  const t = useTranslations("teams");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [staged, setStaged] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", lat: "", lon: "" });

  function open() {
    setDraft(staged ?? { name: "", lat: "", lon: "" });
    dialogRef.current?.showModal();
  }
  function confirm() {
    if (!draft.name.trim()) return;
    setStaged({ ...draft });
    dialogRef.current?.close();
  }

  return (
    <div>
      <label>
        {t("baseLocation")}
        {staged ? (
          <div className="staged-loc">
            <span className="badge">
              {t("newLabel")}: {staged.name}
            </span>
            <button type="button" className="link-danger" onClick={() => setStaged(null)}>
              ×
            </button>
          </div>
        ) : (
          <select name="base_location_id" defaultValue={defaultLocationId ?? ""}>
            <option value="">—</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name ?? l.id}
              </option>
            ))}
          </select>
        )}
        <span className="help">{t("baseLocationHelp")}</span>
      </label>

      <button type="button" className="btn-ghost" onClick={open}>
        {t("newLocation")}
      </button>

      {staged && (
        <>
          <input type="hidden" name="new_location_name" value={staged.name} />
          <input type="hidden" name="new_location_lat" value={staged.lat} />
          <input type="hidden" name="new_location_lon" value={staged.lon} />
        </>
      )}

      <dialog ref={dialogRef} className="modal">
        <h3>{t("newLocationTitle")}</h3>
        <label>
          {t("newLocationName")}
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            autoFocus
          />
        </label>
        <div className="row-2">
          <label>
            {t("lat")}
            <input
              type="number"
              step="any"
              value={draft.lat}
              onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
            />
          </label>
          <label>
            {t("lon")}
            <input
              type="number"
              step="any"
              value={draft.lon}
              onChange={(e) => setDraft({ ...draft, lon: e.target.value })}
            />
          </label>
        </div>
        <span className="help">{t("newLocationHelp")}</span>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={() => dialogRef.current?.close()}>
            {t("cancel")}
          </button>
          <button type="button" className="btn" onClick={confirm}>
            {t("addLocation")}
          </button>
        </div>
      </dialog>
    </div>
  );
}
