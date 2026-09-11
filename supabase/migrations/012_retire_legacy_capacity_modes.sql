-- Replace Busy/dated/contract capacity with current radius-or-route signals.

alter table public.capacity_updates
  add column if not exists availability_geometry text,
  add column if not exists work_radius_km integer;

alter table public.capacity_updates
  drop constraint if exists capacity_market_status_check,
  drop constraint if exists capacity_busy_availability_check;

update public.capacity_updates
set status=case when status::text='BUSY' then 'OFF_DUTY'::public.capacity_status else status end,
    market_status=case when market_status='BUSY' then 'OFF_DUTY' else market_status end,
    available_percent=case when status::text='BUSY' or market_status='BUSY' then 0 else available_percent end,
    accepts_full_load=case when status::text='BUSY' or market_status='BUSY' then false else accepts_full_load end,
    accepts_partial_load=case when status::text='BUSY' or market_status='BUSY' then false else accepts_partial_load end,
    accepts_multi_pick=case when status::text='BUSY' or market_status='BUSY' then false else accepts_multi_pick end,
    accepts_multi_drop=case when status::text='BUSY' or market_status='BUSY' then false else accepts_multi_drop end,
    accepts_multi_stop=case when status::text='BUSY' or market_status='BUSY' then false else accepts_multi_stop end,
    current_route_origin=case
      when status::text='BUSY' or market_status='BUSY' then null
      else coalesce(current_route_origin,origin) end,
    current_route_destination=case
      when status::text='BUSY' or market_status='BUSY' then null
      else coalesce(current_route_destination,destination) end,
    current_origin_place_ref=case when status::text='BUSY' or market_status='BUSY' then null else coalesce(current_origin_place_ref,origin_place_ref) end,
    current_origin_lat=case when status::text='BUSY' or market_status='BUSY' then null else coalesce(current_origin_lat,origin_lat) end,
    current_origin_lng=case when status::text='BUSY' or market_status='BUSY' then null else coalesce(current_origin_lng,origin_lng) end,
    current_destination_place_ref=case when status::text='BUSY' or market_status='BUSY' then null else coalesce(current_destination_place_ref,destination_place_ref) end,
    current_destination_lat=case when status::text='BUSY' or market_status='BUSY' then null else coalesce(current_destination_lat,destination_lat) end,
    current_destination_lng=case when status::text='BUSY' or market_status='BUSY' then null else coalesce(current_destination_lng,destination_lng) end,
    availability_geometry=case
      when status::text='BUSY' or market_status='BUSY' then null
      when coalesce(current_route_origin,origin) is not null
       and coalesce(current_route_destination,destination) is not null
       and coalesce(current_origin_lat,origin_lat) is not null
       and coalesce(current_destination_lat,destination_lat) is not null then 'ROUTE'
      else 'RADIUS' end,
    work_radius_km=case
      when status::text='BUSY' or market_status='BUSY' then null
      else greatest(5,least(500,coalesce(work_radius_km,local_radius_km,50))) end,
    origin=case when status::text='BUSY' or market_status='BUSY' then null else origin end,
    destination=case when status::text='BUSY' or market_status='BUSY' then null else destination end,
    corridor=case when status::text='BUSY' or market_status='BUSY' then null else corridor end,
    location_area=case when status::text='BUSY' or market_status='BUSY' then null else location_area end,
    location_updated_at=case when status::text='BUSY' or market_status='BUSY' then null else location_updated_at end,
    location_lat=case when status::text='BUSY' or market_status='BUSY' then null else location_lat end,
    location_lng=case when status::text='BUSY' or market_status='BUSY' then null else location_lng end,
    location_precision_km=case when status::text='BUSY' or market_status='BUSY' then null else location_precision_km end,
    location_source=case when status::text='BUSY' or market_status='BUSY' then null else location_source end,
    travel_date=null,
    current_route_date=null,
    open_to_contract_lanes=false,
    available_again_date=null,
    available_again_place_ref=null,
    available_again_place_label=null,
    available_again_lat=null,
    available_again_lng=null;

alter table public.capacity_updates
  add constraint capacity_market_status_check
    check(market_status in ('EMPTY','PARTIAL','OFF_DUTY')),
  add constraint capacity_availability_geometry_check
    check(availability_geometry is null or availability_geometry in ('RADIUS','ROUTE')),
  add constraint capacity_work_radius_check
    check(work_radius_km is null or work_radius_km between 5 and 500),
  add constraint capacity_current_geometry_check
    check(
      coalesce(market_status,status::text)='OFF_DUTY'
      or availability_geometry='RADIUS'
      or (
        availability_geometry='ROUTE'
        and current_route_origin is not null
        and current_route_destination is not null
        and current_origin_lat is not null
        and current_origin_lng is not null
        and current_destination_lat is not null
        and current_destination_lng is not null
      )
    ),
  add constraint capacity_partial_route_only_check
    check(coalesce(market_status,status::text)<>'PARTIAL' or availability_geometry='ROUTE');
