-- ============================================================================
-- Pin manually-moved assignments.
--
-- When a planner drags a card to a different team/day, that placement is a
-- deliberate decision. Marking it `manual` means "Yeniden Oluştur" keeps it
-- where it was put (like started/completed work), reserving its team-day and
-- subtracting its units, and only re-plans the remaining auto assignments.
-- Clearing the plan still removes it.
-- ============================================================================

alter table assignment add column if not exists manual boolean not null default false;
