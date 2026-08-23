-- FEAT-FTR-001: automatic/manual two-session featured-transporter schedule.

alter table public.featured_provider_days
  add column if not exists schedule_mode text not null default 'AUTO',
  add column if not exists schedule_config_json jsonb not null default '{}'::jsonb,
  add column if not exists manual_schedule_json jsonb not null default '[]'::jsonb;

alter table public.featured_provider_days
  drop constraint if exists featured_provider_days_schedule_mode_check;

alter table public.featured_provider_days
  add constraint featured_provider_days_schedule_mode_check
    check (schedule_mode in ('AUTO','MANUAL'));

alter table public.featured_provider_days
  alter column broadcast_start_time set default '08:00',
  alter column broadcast_end_time set default '22:00';

comment on column public.featured_provider_days.schedule_mode is
  'AUTO uses the deterministic two-session scheduler; MANUAL uses validated provider intervals.';

comment on column public.featured_provider_days.schedule_config_json is
  'Bounded Ethiopia-time session, transition, Sponsor-break, and presentation-duration settings.';

comment on column public.featured_provider_days.manual_schedule_json is
  'Administrator-authored provider intervals validated against roster order and session boundaries.';
