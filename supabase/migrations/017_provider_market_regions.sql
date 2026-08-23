-- FEAT-PRV-001 / FEAT-FTR-001: general provider base regions and weekday expo groups.

alter table public.company_pages
  add column if not exists base_region_code text,
  add constraint company_pages_base_region_code_check check (
    base_region_code is null or base_region_code in (
      'ADDIS_ABABA','AFAR','AMHARA','BENISHANGUL_GUMUZ','CENTRAL_ETHIOPIA','DIRE_DAWA','GAMBELLA',
      'HARARI','OROMIA','SIDAMA','SOMALI','SOUTH_ETHIOPIA','SOUTH_WEST_ETHIOPIA','TIGRAY'
    )
  );

alter table public.featured_provider_days
  drop constraint if exists featured_provider_days_base_place_ref_fkey,
  add column if not exists expo_group_key text,
  add column if not exists expo_group_label text,
  add column if not exists expo_region_codes jsonb;

comment on column public.company_pages.base_region_code is
  'Provider-selected general regional state or Addis Ababa/Dire Dawa city administration; never an exact office location.';
comment on column public.featured_provider_days.expo_group_key is
  'Fixed seven-day regional expo group derived from feature_date in Africa/Addis_Ababa.';
