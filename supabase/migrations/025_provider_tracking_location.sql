-- Add the customer-owner Tracking travel phase and consent-gated approximate Driver location snapshots.

alter table public.provider_shipments
  drop constraint if exists provider_shipments_operational_status_check;

alter table public.provider_shipments
  add constraint provider_shipments_operational_status_check
  check (operational_status in ('CREATED','TO_PICKUP','LOADING','IN_TRANSIT','UNLOADING','COMPLETED','ISSUE'));

alter table public.provider_shipment_events
  add column if not exists event_type text not null default 'STATUS',
  add column if not exists location_area text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_precision_km integer,
  add column if not exists location_source text;

create index if not exists provider_shipment_location_idx
  on public.provider_shipment_events(shipment_id,event_type,created_at desc);

comment on column public.provider_shipment_events.location_lat is
  'Browser-obscured coordinate only. Exact Driver device coordinates must never be submitted.';
