-- FEAT-FTR-001: variable venue roster and administrator-managed broadcast window.

alter table public.featured_provider_days
  add column if not exists broadcast_start_time time not null default '10:00',
  add column if not exists broadcast_end_time time not null default '14:00';

alter table public.featured_provider_days
  add constraint featured_provider_days_broadcast_window
    check (broadcast_end_time > broadcast_start_time);

alter table public.featured_provider_slots
  drop constraint if exists featured_provider_slots_slot_position_check;

alter table public.featured_provider_slots
  add constraint featured_provider_slots_slot_position_positive
    check (slot_position >= 1);

comment on column public.featured_provider_days.broadcast_start_time is
  'Administrator-set Ethiopia local time used to derive proportional public booth walkthroughs.';
