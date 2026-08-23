-- FEAT-PRV-001: provider-owned public identity image stored behind the application projection.

alter table public.company_pages
  add column if not exists profile_image_path text,
  add column if not exists profile_image_mime text,
  add column if not exists profile_image_updated_at timestamptz;

comment on column public.company_pages.profile_image_path is
  'Private storage reference. Never include this value in an anonymous projection.';
