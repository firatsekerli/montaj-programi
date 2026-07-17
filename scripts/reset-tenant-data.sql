-- ============================================================================
-- RESET DOMAIN DATA — start from scratch.
--
-- Deletes all orders, plans, teams, people, assets, sites, door types, rules,
-- leave and notifications. KEEPS: your login (tenant, membership, app_user),
-- tenant settings (working days / buffer / shift), and the location list so a
-- team can still pick a base.
--
-- Run in the Supabase SQL Editor. Safe to run repeatedly.
-- ============================================================================

begin;

delete from assignment;
delete from task;
delete from plan;
delete from order_line;
delete from work_order;
delete from availability;
delete from team_member;
delete from team_capability;
delete from asset_capacity;
delete from asset_dependency;
delete from asset;
delete from site;
delete from team;
delete from person;
delete from capacity_rule;
delete from work_item_type;

commit;
