-- Driver-controlled capacity privacy and evidence-specific trust badges.

alter type public.verification_type add value if not exists 'BUSINESS_ADDRESS';

alter table public.verification_requests
  add column if not exists related_vehicle_id uuid references public.vehicles(id),
  add column if not exists expires_on date;

create index if not exists verification_vehicle_pair_idx
  on public.verification_requests(subject_type,subject_id,related_vehicle_id,verification_type,status,expires_on);

alter table public.capacity_updates
  drop constraint if exists capacity_device_location_check;

alter table public.capacity_updates
  add constraint capacity_device_location_check
    check(
      coalesce(market_status,status::text)='OFF_DUTY'
      or (
        location_source='DEVICE_OBSCURED'
        and location_updated_at is not null
        and location_lat between 3 and 15
        and location_lng between 32 and 49
        and location_precision_km in (1,3,5,10,20,40)
      )
    );

comment on column public.verification_requests.related_vehicle_id is
  'Required for pairing-specific VEHICLE_AUTHORIZATION evidence.';
comment on column public.verification_requests.expires_on is
  'Expiry shown with time-bounded evidence; expired evidence is not a current verified badge.';
