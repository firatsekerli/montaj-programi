"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateLocation } from "@/app/actions/locations";

export interface LocationOption {
  id: string;
  name: string | null;
  lat?: number | null;
  lon?: number | null;
}
interface Draft {
  name: string;
  lat: string;
  lon: string;
}

/**
 * Base-location picker: choose an existing location, EDIT the selected one, or
 * add a new one — all via one modal. A new location is staged and submitted
 * with the team form; editing an existing one saves immediately.
 */
export function BaseLocationField({
  locations,
  defaultLocationId,
}: {
  locations: LocationOption[];
  defaultLocationId?: string | null;
}) {
  const t = useTranslations("teams");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(defaultLocationId ?? "");
  const [staged, setStaged] = useState<Draft | null>(null);
  const [mode, setMode] = useState<"new" | "edit">("new");
  const [draft, setDraft] = useState<Draft>({ name: "", lat: "", lon: "" });

  function openNew() {
    setMode("new");
    setDraft({ name: "", lat: "", lon: "" });
    dialogRef.current?.showModal();
  }
  function openEdit() {
    const loc = locations.find((l) => l.id === selectedId);
    if (!loc) return;
    setMode("edit");
    setDraft({
      name: loc.name ?? "",
      lat: loc.lat != null ? String(loc.lat) : "",
      lon: loc.lon != null ? String(loc.lon) : "",
    });
    dialogRef.current?.showModal();
  }
  function confirm() {
    if (!draft.name.trim()) return;
    if (mode === "new") {
      setStaged({ ...draft });
    } else {
      startTransition(async () => {
        await updateLocation(selectedId, draft);
        router.refresh();
      });
    }
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
          <select
            name="base_location_id"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
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

      {staged && (
        <>
          <input type="hidden" name="new_location_name" value={staged.name} />
          <input type="hidden" name="new_location_lat" value={staged.lat} />
          <input type="hidden" name="new_location_lon" value={staged.lon} />
        </>
      )}

      <div className="loc-actions">
        {!staged && selectedId && (
          <button type="button" className="btn-ghost" onClick={openEdit}>
            {t("editLocation")}
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={openNew}>
          {t("newLocation")}
        </button>
      </div>

      <dialog ref={dialogRef} className="modal">
        <h3>{mode === "edit" ? t("editLocationTitle") : t("newLocationTitle")}</h3>
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
            {mode === "edit" ? t("saveLocation") : t("addLocation")}
          </button>
        </div>
      </dialog>
    </div>
  );
}
