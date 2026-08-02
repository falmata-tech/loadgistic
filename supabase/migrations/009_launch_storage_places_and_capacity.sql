-- Launch alignment for private payment media, fast place search, and Busy capacity.

alter type public.capacity_status add value if not exists 'BUSY';

alter table public.capacity_updates
  add column if not exists market_status text,
  add column if not exists available_again_date date;

update public.capacity_updates
set market_status=coalesce(market_status,status::text);

alter table public.capacity_updates
  alter column market_status set default 'OFF_DUTY';

do $$
begin
  if not exists (select 1 from pg_constraint where conname='capacity_market_status_check') then
    alter table public.capacity_updates add constraint capacity_market_status_check
      check(market_status in ('EMPTY','PARTIAL','BUSY','OFF_DUTY'));
  end if;
end $$;

alter table public.payment_proofs
  add column if not exists original_name text,
  add column if not exists mime_type text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-proof','payment-proof',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create extension if not exists pg_trgm with schema extensions;

create index if not exists place_catalog_name_prefix_idx
  on public.place_catalog(normalized_name text_pattern_ops);
create index if not exists place_catalog_search_trgm_idx
  on public.place_catalog using gin (
    lower(name || ' ' || coalesce(alternate_names,'') || ' ' || coalesce(parent_name,'')) extensions.gin_trgm_ops
  );
create index if not exists capacity_busy_discovery_idx
  on public.capacity_updates(market_status,available_again_date,updated_at desc);
