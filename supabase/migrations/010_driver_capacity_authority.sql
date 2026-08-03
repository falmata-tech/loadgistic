-- Driver-authoritative current location and status-appropriate capacity rules.

alter table public.capacity_updates
  add column if not exists available_again_place_ref text references public.place_catalog(id),
  add column if not exists available_again_place_label text,
  add column if not exists available_again_lat double precision,
  add column if not exists available_again_lng double precision;

alter table public.capacity_updates
  drop constraint if exists capacity_local_status_check,
  drop constraint if exists capacity_local_radius_check,
  drop constraint if exists capacity_percentage_check,
  drop constraint if exists capacity_busy_availability_check;

-- A typed legacy area cannot remain an active production truck signal.
update public.capacity_updates
set status='OFF_DUTY'::public.capacity_status,
    market_status='OFF_DUTY',
    available_percent=0,
    accepts_full_load=false,
    accepts_partial_load=false,
    location_area=null,
    location_updated_at=null,
    location_lat=null,
    location_lng=null,
    location_precision_km=null,
    location_source=null
where coalesce(market_status,status::text)<>'OFF_DUTY'
  and coalesce(location_source,'')<>'DEVICE_OBSCURED';

-- Old Busy signals did not record a distinct expected place.
update public.capacity_updates
set status='OFF_DUTY'::public.capacity_status,
    market_status='OFF_DUTY',
    available_percent=0,
    available_again_date=null
where coalesce(market_status,status::text)='BUSY'
  and (
    available_again_place_ref is null
    or available_again_lat is null
    or available_again_lng is null
  );

update public.capacity_updates
set local_radius_km=greatest(10,least(50,coalesce(local_radius_km,25)))
where movement_scope in ('LOCAL','BOTH');

alter table public.capacity_updates
  add constraint capacity_local_radius_check
    check(local_radius_km is null or local_radius_km between 10 and 50),
  add constraint capacity_percentage_check
    check(
      (coalesce(market_status,status::text)='EMPTY' and available_percent=100)
      or (coalesce(market_status,status::text)='PARTIAL' and available_percent between 1 and 99)
      or (coalesce(market_status,status::text) in ('BUSY','OFF_DUTY') and available_percent=0)
    ),
  add constraint capacity_partial_policy_check
    check(
      coalesce(market_status,status::text)<>'PARTIAL'
      or (
        accepts_full_load=false
        and accepts_partial_load=true
        and current_origin_place_ref is not null
        and current_destination_place_ref is not null
      )
    ),
  add constraint capacity_busy_availability_check
    check(
      coalesce(market_status,status::text)<>'BUSY'
      or (
        available_again_date is not null
        and available_again_place_ref is not null
        and available_again_lat between 3 and 15
        and available_again_lng between 32 and 49
      )
    ),
  add constraint capacity_device_location_check
    check(
      coalesce(market_status,status::text)='OFF_DUTY'
      or (
        location_source='DEVICE_OBSCURED'
        and location_updated_at is not null
        and location_lat between 3 and 15
        and location_lng between 32 and 49
        and location_precision_km=40
      )
    );

create index if not exists capacity_driver_location_idx
  on public.capacity_updates(vehicle_id,location_updated_at desc)
  where location_source='DEVICE_OBSCURED';
