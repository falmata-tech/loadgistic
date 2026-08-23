-- FEAT-PRV-001: optional public preset used only by seeded pre-launch transporter fixtures.

alter table public.company_pages
  add column if not exists profile_image_preset text;

comment on column public.company_pages.profile_image_preset is
  'Allowlisted public portrait filename for seeded transporter fixtures. Owner uploads take priority.';

alter table public.company_pages
  drop constraint if exists company_pages_profile_image_preset_safe;

alter table public.company_pages
  add constraint company_pages_profile_image_preset_safe
  check (profile_image_preset is null or profile_image_preset ~ '^[a-z0-9-]+\.png$');

-- Fixture imports set this value from their allowlisted portrait manifest.
-- Do not identify fixture rows by the legacy SQLite text IDs: PostgreSQL page
-- IDs are UUIDs, and production rows must never be assigned a guessed asset.
