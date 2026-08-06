"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { moveAssignment, recordInstalled, undoInstalled, unpinAssignment } from "@/app/actions/planning";

export interface BoardAssignment {
  id: string;
  teamId: string;
  date: string;
  units: number;
  cost: number;
  orderCode: string;
  typeName: string;
  /** Dragged into place by the planner — kept across "Yeniden Oluştur". */
  manual?: boolean;
  /** Order's delivery deadline; a card past it is "late" and shown in red. */
  deliveryDate?: string | null;
  /** planned | in_progress | completed | blocked. Completed = installed/locked. */
  status?: string;
}
interface TeamRow {
  id: string;
  name: string;
}

/** Monday (UTC) of the week containing an ISO date. */
function mondayOfISO(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** True for a Saturday/Sunday (UTC). */
function isWeekend(iso: string): boolean {
  const g = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return g === 0 || g === 6;
}

export function PlanningBoard({
  teams,
  weekDays,
  assignments,
}: {
  teams: TeamRow[];
  weekDays: string[];
  assignments: BoardAssignment[];
}) {
  const [items, setItems] = useState(assignments);
  // Re-sync when the server sends new data (after generate/regenerate, week
  // navigation, or a move+refresh). useState only seeds on mount, so without
  // this the board would keep showing stale state after "Yeniden Oluştur".
  useEffect(() => {
    setItems(assignments);
  }, [assignments]);
  const [, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();
  const format = useFormatter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // A weekend column stays narrow until a card is dropped on it (anywhere in the
  // column). Computed once so header and every row cell agree on the width.
  const narrowDays = new Set(
    weekDays.filter((d) => isWeekend(d) && !items.some((a) => a.date === d)),
  );
  // Day columns keep a comfortable minimum width; when the 9 days don't fit, the
  // board scrolls horizontally inside its own container instead of squashing.
  const template = `var(--team-col) ${weekDays
    .map((d) => (narrowDays.has(d) ? "var(--wk-narrow)" : "minmax(150px, 1fr)"))
    .join(" ")}`;

  function apply(id: string, teamId: string, date: string) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, teamId, date, manual: true } : a)));
    startTransition(async () => {
      const res = await moveAssignment(id, teamId, date);
      if (res?.warning) setNotice(res.warning);
      // Stay put if the target is already visible; otherwise jump to its week.
      if (weekDays.includes(date)) router.refresh();
      else router.push(`/planning?week=${mondayOfISO(date)}`);
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    if (!e.over) return;
    const [teamId, date] = String(e.over.id).split("|");
    if (!teamId || !date) return;
    const current = items.find((a) => a.id === id);
    if (!current || (current.teamId === teamId && current.date === date)) return;
    apply(id, teamId, date);
  }

  function onUnpin(id: string) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, manual: false } : a)));
    startTransition(async () => {
      await unpinAssignment(id);
      router.refresh();
    });
  }

  function onRecord(id: string, installed: number) {
    startTransition(async () => {
      await recordInstalled(id, installed);
      router.refresh();
    });
  }

  function onUndo(id: string) {
    startTransition(async () => {
      await undoInstalled(id);
      router.refresh();
    });
  }

  // A slim scrollbar strip above the board, kept in sync with it — so the
  // horizontal scroll is always visible without scrolling to the board's bottom.
  const topRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(0);
  useEffect(() => {
    const inner = innerRef.current;
    const scroll = boardRef.current;
    if (!inner || !scroll) return;
    // scrollWidth = the full board extent including the part that overflows the
    // scroll container — that's what the top scrollbar's spacer must match.
    const update = () => setBoardWidth(scroll.scrollWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [weekDays, items]);
  const syncFrom = (src: HTMLDivElement | null, dst: HTMLDivElement | null) => {
    if (src && dst && dst.scrollLeft !== src.scrollLeft) dst.scrollLeft = src.scrollLeft;
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {notice && (
        <div className="plan-notice" role="status">
          <span>⚠️ {notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Kapat">
            ×
          </button>
        </div>
      )}
      <div
        className="board-topscroll"
        ref={topRef}
        onScroll={() => syncFrom(topRef.current, boardRef.current)}
      >
        <div style={{ width: boardWidth }} />
      </div>
      <div
        className="board-scroll"
        ref={boardRef}
        onScroll={() => syncFrom(boardRef.current, topRef.current)}
      >
        <div className="board" ref={innerRef} style={{ gridTemplateColumns: template }}>
          <div className="board-cell head team-col" />
          {weekDays.map((d) => (
            <div
              key={d}
              className={`board-cell head${isWeekend(d) ? " weekend" : ""}${narrowDays.has(d) ? " narrow" : ""}`}
            >
              {format.dateTime(new Date(`${d}T00:00:00`), {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </div>
          ))}

          {teams.map((team) => (
            <BoardRow
              key={team.id}
              team={team}
              teams={teams}
              weekDays={weekDays}
              narrowDays={narrowDays}
              items={items}
              onUnpin={onUnpin}
              onMove={apply}
              onRecord={onRecord}
              onUndo={onUndo}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

function BoardRow({
  team,
  teams,
  weekDays,
  narrowDays,
  items,
  onUnpin,
  onMove,
  onRecord,
  onUndo,
}: {
  team: TeamRow;
  teams: TeamRow[];
  weekDays: string[];
  narrowDays: Set<string>;
  items: BoardAssignment[];
  onUnpin: (id: string) => void;
  onMove: (id: string, teamId: string, date: string) => void;
  onRecord: (id: string, installed: number) => void;
  onUndo: (id: string) => void;
}) {
  return (
    <>
      <div className="board-cell team-col">{team.name}</div>
      {weekDays.map((d) => {
        const cell = items.filter((a) => a.teamId === team.id && a.date === d);
        const usage = cell.reduce((s, a) => s + a.cost, 0);
        return (
          <Cell
            key={d}
            cellId={`${team.id}|${d}`}
            usage={usage}
            cards={cell}
            teams={teams}
            weekend={isWeekend(d)}
            narrow={narrowDays.has(d)}
            onUnpin={onUnpin}
            onMove={onMove}
            onRecord={onRecord}
            onUndo={onUndo}
          />
        );
      })}
    </>
  );
}

function Cell({
  cellId,
  usage,
  cards,
  teams,
  weekend,
  narrow,
  onUnpin,
  onMove,
  onRecord,
  onUndo,
}: {
  cellId: string;
  usage: number;
  cards: BoardAssignment[];
  teams: TeamRow[];
  weekend: boolean;
  narrow: boolean;
  onUnpin: (id: string) => void;
  onMove: (id: string, teamId: string, date: string) => void;
  onRecord: (id: string, installed: number) => void;
  onUndo: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId });
  const over = usage > 1.0001;
  return (
    <div
      ref={setNodeRef}
      className={`board-cell drop${isOver ? " over" : ""}${weekend ? " weekend" : ""}${narrow ? " narrow" : ""}`}
    >
      <div className="usage">
        <span className={`usage-pct${over ? " over-cap" : ""}`}>{Math.round(usage * 100)}%</span>
        <div className="usage-track">
          <div
            className={`usage-bar${over ? " over-cap" : ""}`}
            style={{ width: `${Math.min(usage, 1) * 100}%` }}
          />
        </div>
      </div>
      {cards.map((c) => (
        <Card key={c.id} a={c} teams={teams} onUnpin={onUnpin} onMove={onMove} onRecord={onRecord} onUndo={onUndo} />
      ))}
    </div>
  );
}

function Card({
  a,
  teams,
  onUnpin,
  onMove,
  onRecord,
  onUndo,
}: {
  a: BoardAssignment;
  teams: TeamRow[];
  onUnpin: (id: string) => void;
  onMove: (id: string, teamId: string, date: string) => void;
  onRecord: (id: string, installed: number) => void;
  onUndo: (id: string) => void;
}) {
  const t = useTranslations("planning");
  // Completed (installed) cards are locked — no drag, no move panel.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: a.id,
    disabled: a.status === "completed",
  });
  const [editing, setEditing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [team, setTeam] = useState(a.teamId);
  const [date, setDate] = useState(a.date);
  const [installed, setInstalled] = useState(a.units);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 20 }
    : undefined;
  const late = Boolean(a.deliveryDate && a.date > a.deliveryDate);
  const doneCard = a.status === "completed";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card-plan${isDragging ? " dragging" : ""}${late ? " late" : ""}${doneCard ? " done" : ""}`}
      {...listeners}
      {...attributes}
    >
      <strong>
        {doneCard && "✓ "}
        {a.orderCode}
        {late && (
          <span className="late-badge" title={t("lateTitle")}>
            {t("late")}
          </span>
        )}
        {a.manual && (
          <button
            type="button"
            className="pin"
            title={t("unpin")}
            onPointerDown={stop}
            onClick={(e) => {
              stop(e);
              onUnpin(a.id);
            }}
          >
            📌
          </button>
        )}
        {!doneCard && (
          <span className="card-actions">
            <button
              type="button"
              className="card-action"
              title={t("moveTitle")}
              onPointerDown={stop}
              onClick={(e) => {
                stop(e);
                setTeam(a.teamId);
                setDate(a.date);
                setEditing((v) => !v);
                setRecording(false);
              }}
            >
              {t("move")}
            </button>
            <button
              type="button"
              className="card-action record"
              title={t("recordTitle")}
              onPointerDown={stop}
              onClick={(e) => {
                stop(e);
                setInstalled(a.units);
                setRecording((v) => !v);
                setEditing(false);
              }}
            >
              {t("recordChip")}
            </button>
          </span>
        )}
        {doneCard && (
          <span className="card-actions">
            <button
              type="button"
              className="card-action undo"
              title={t("undoTitle")}
              onPointerDown={stop}
              onClick={(e) => {
                stop(e);
                onUndo(a.id);
              }}
            >
              {t("undo")}
            </button>
          </span>
        )}
      </strong>
      <span className="card-line">
        {a.units}× {a.typeName}
      </span>
      <span className="card-cost">
        {doneCard ? t("installedDone", { n: a.units }) : t("dayShare", { pct: Math.round(a.cost * 100) })}
      </span>

      {editing && (
        <div className="card-move-panel" onPointerDown={stop}>
          <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label={t("moveTeam")}>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("moveDate")} />
          <button
            type="button"
            className="btn-ghost"
            onClick={(e) => {
              stop(e);
              setEditing(false);
              if (date) onMove(a.id, team, date);
            }}
          >
            {t("move")}
          </button>
        </div>
      )}

      {recording && (
        <div className="card-move-panel" onPointerDown={stop}>
          <label className="card-record-label">
            {t("installed")}
            <input
              type="number"
              min="0"
              max={a.units}
              value={installed}
              onChange={(e) => setInstalled(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="btn-ghost"
            onClick={(e) => {
              stop(e);
              setRecording(false);
              onRecord(a.id, installed);
            }}
          >
            {t("save")}
          </button>
        </div>
      )}
    </div>
  );
}
