-- FEAT-FTR-001: safe static portrait presets for Driver-led Featured cards.

alter table public.profiles
  add column if not exists driver_portrait_preset text;

alter table public.profiles
  drop constraint if exists profiles_driver_portrait_preset_safe,
  add constraint profiles_driver_portrait_preset_safe check (
    driver_portrait_preset is null
    or (role='DRIVER' and driver_portrait_preset ~ '^[a-z0-9-]+\.jpg$')
  );

comment on column public.profiles.driver_portrait_preset is
  'Allowlisted fictional static portrait filename for demo Drivers. Null renders the neutral Driver icon.';
