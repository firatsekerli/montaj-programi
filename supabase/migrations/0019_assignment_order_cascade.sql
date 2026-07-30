-- ============================================================================
-- Cascade assignments when their order (or order line) is deleted.
--
-- assignment.order_id / order_line_id were created without ON DELETE CASCADE, so
-- deleting a work_order that still had assignments failed on the foreign key.
-- Re-create both constraints with cascade so a sipariş can be removed cleanly.
-- ============================================================================

alter table assignment drop constraint if exists assignment_order_id_fkey;
alter table assignment
  add constraint assignment_order_id_fkey
  foreign key (order_id) references work_order (id) on delete cascade;

alter table assignment drop constraint if exists assignment_order_line_id_fkey;
alter table assignment
  add constraint assignment_order_line_id_fkey
  foreign key (order_line_id) references order_line (id) on delete cascade;
