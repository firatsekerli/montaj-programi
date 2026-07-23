"use client";

import { useEffect, useState, useTransition } from "react";
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
import { moveAssignment, unpinAssignment } from "@/app/actions/planning";

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
  const router = useRouter();
  const format = useFormatter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const currentWeek = weekDays[0];

  function apply(id: string, teamId: string, date: string) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, teamId, date, manual: true } : a)));
    startTransition(async () => {
      await moveAssignment(id, teamId, date);
      // If the target lands in another week, jump there so the card is visible.
      const target = mondayOfISO(date);
      if (target !== currentWeek) router.push(`/planning?week=${target}`);
      else router.refresh();
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

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="board-scroll">
        <div className="board" style={{ gridTemplateColumns: `160px repeat(${weekDays.length}, 1fr)` }}>
          <div className="board-cell head team-col" />
          {weekDays.map((d) => (
            <div key={d} className="board-cell head">
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
              items={items}
              onUnpin={onUnpin}
              onMove={apply}
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
  items,
  onUnpin,
  onMove,
}: {
  team: TeamRow;
  teams: TeamRow[];
  weekDays: string[];
  items: BoardAssignment[];
  onUnpin: (id: string) => void;
  onMove: (id: string, teamId: string, date: string) => void;
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
            onUnpin={onUnpin}
            onMove={onMove}
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
  onUnpin,
  onMove,
}: {
  cellId: string;
  usage: number;
  cards: BoardAssignment[];
  teams: TeamRow[];
  onUnpin: (id: string) => void;
  onMove: (id: string, teamId: string, date: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId });
  const over = usage > 1.0001;
  return (
    <div ref={setNodeRef} className={`board-cell drop${isOver ? " over" : ""}`}>
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
        <Card key={c.id} a={c} teams={teams} onUnpin={onUnpin} onMove={onMove} />
      ))}
    </div>
  );
}

function Card({
  a,
  teams,
  onUnpin,
  onMove,
}: {
  a: BoardAssignment;
  teams: TeamRow[];
  onUnpin: (id: string) => void;
  onMove: (id: string, teamId: string, date: string) => void;
}) {
  const t = useTranslations("planning");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: a.id });
  const [editing, setEditing] = useState(false);
  const [team, setTeam] = useState(a.teamId);
  const [date, setDate] = useState(a.date);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 20 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card-plan${isDragging ? " dragging" : ""}`}
      {...listeners}
      {...attributes}
    >
      <strong>
        {a.orderCode}
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
        <button
          type="button"
          className="card-move"
          title={t("moveTitle")}
          onPointerDown={stop}
          onClick={(e) => {
            stop(e);
            setTeam(a.teamId);
            setDate(a.date);
            setEditing((v) => !v);
          }}
        >
          📅
        </button>
      </strong>
      <span className="card-line">
        {a.units}× {a.typeName}
      </span>
      <span className="card-cost">{t("dayShare", { pct: Math.round(a.cost * 100) })}</span>

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
    </div>
  );
}
