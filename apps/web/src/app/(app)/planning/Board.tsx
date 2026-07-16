"use client";

import { useState, useTransition } from "react";
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
import { moveAssignment } from "@/app/actions/planning";

export interface BoardAssignment {
  id: string;
  teamId: string;
  date: string;
  units: number;
  cost: number;
  orderCode: string;
  typeName: string;
}
interface TeamRow {
  id: string;
  name: string;
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
  const [, startTransition] = useTransition();
  const router = useRouter();
  const format = useFormatter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    if (!e.over) return;
    const [teamId, date] = String(e.over.id).split("|");
    if (!teamId || !date) return;
    const current = items.find((a) => a.id === id);
    if (!current || (current.teamId === teamId && current.date === date)) return;

    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, teamId, date } : a)));
    startTransition(async () => {
      await moveAssignment(id, teamId, date);
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
            <BoardRow key={team.id} team={team} weekDays={weekDays} items={items} />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

function BoardRow({
  team,
  weekDays,
  items,
}: {
  team: TeamRow;
  weekDays: string[];
  items: BoardAssignment[];
}) {
  return (
    <>
      <div className="board-cell team-col">{team.name}</div>
      {weekDays.map((d) => {
        const cell = items.filter((a) => a.teamId === team.id && a.date === d);
        const usage = cell.reduce((s, a) => s + a.cost, 0);
        return <Cell key={d} cellId={`${team.id}|${d}`} usage={usage} cards={cell} />;
      })}
    </>
  );
}

function Cell({
  cellId,
  usage,
  cards,
}: {
  cellId: string;
  usage: number;
  cards: BoardAssignment[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId });
  const over = usage > 1.0001;
  return (
    <div ref={setNodeRef} className={`board-cell drop${isOver ? " over" : ""}`}>
      <div className="usage">
        <div
          className={`usage-bar${over ? " over-cap" : ""}`}
          style={{ width: `${Math.min(usage, 1) * 100}%` }}
        />
        <span className="usage-pct">{Math.round(usage * 100)}%</span>
      </div>
      {cards.map((c) => (
        <Card key={c.id} a={c} />
      ))}
    </div>
  );
}

function Card({ a }: { a: BoardAssignment }) {
  const t = useTranslations("planning");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: a.id });
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
      <strong>{a.orderCode}</strong>
      <span className="card-line">
        {a.units}× {a.typeName}
      </span>
      <span className="card-cost">{t("dayShare", { pct: Math.round(a.cost * 100) })}</span>
    </div>
  );
}
