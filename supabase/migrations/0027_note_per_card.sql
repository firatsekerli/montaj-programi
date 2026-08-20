-- ============================================================================
-- Notes per CARD (assignment), not per order.
--
-- Previously a note attached to the whole order and appeared on every card of
-- that order. When an order is split across cards (e.g. 5 of 8 installed on one
-- day, the remaining 3 on another), each card needs its OWN notes. We add an
-- optional assignment_id: notes with an assignment_id belong to that single
-- card; legacy notes (assignment_id NULL) keep their old order-wide behavior.
--
-- On re-plan, cards that carry a note are preserved (see generatePlan), so a
-- card-scoped note is not lost. Idempotent.
-- ============================================================================

alter table order_note
  add column if not exists assignment_id uuid references assignment (id) on delete cascade;
create index if not exists order_note_assignment_idx on order_note (assignment_id, created_at);
