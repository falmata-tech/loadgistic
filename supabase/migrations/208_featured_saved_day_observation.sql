-- FEAT-CON-001: observe each imported Featured day once. A saved day whose
-- account already has a turn in the current round must not become a new turn
-- when a later generator call advances to another round.
begin;
select pg_advisory_xact_lock(8030180);

create table public.featured_account_saved_day_observations (
  featured_day_id uuid not null references public.featured_provider_days(id) on delete cascade,
  provider_key text not null check (provider_key ~ '^(organization|profile):[0-9a-f-]{36}$'),
  feature_date date not null,
  observed_at timestamptz not null default now(),
  primary key (featured_day_id,provider_key)
);
alter table public.featured_account_saved_day_observations enable row level security;
revoke all on public.featured_account_saved_day_observations from public,anon,authenticated,service_role;
grant select on public.featured_account_saved_day_observations to service_role;

do $migration$
declare definition text;old_fragment text:=$old$
  -- Fixture and pilot imports may create a saved day after this migration.
  -- Reserve those account turns before preparing another day.
  insert into public.featured_account_rotation_selections
    (round_number,provider_key,featured_day_id,first_feature_date,origin,selected_at)
  select distinct on (account.provider_key) round_value,account.provider_key,day.id,
    day.feature_date,'LEGACY',coalesce(day.published_at,day.created_at)
  from public.featured_provider_days day
  join public.featured_provider_slots slot on slot.day_id=day.id
  cross join lateral (select case when slot.provider_organization_id is not null
    then 'organization:'||slot.provider_organization_id::text
    else 'profile:'||slot.provider_profile_id::text end as provider_key) account
  where day.status='PUBLISHED'
    and not exists(select 1 from public.featured_account_rotation_selections existing
      where existing.featured_day_id=day.id and existing.provider_key=account.provider_key)
  order by account.provider_key,day.feature_date desc,day.id desc
  on conflict(round_number,provider_key) do nothing;
$old$;new_fragment text:=$new$
  -- Imported saved days are observed once, including a day whose account
  -- already has a current-round turn. A retry cannot reassign that old day to
  -- a later round after a conflict.
  with saved as (
    select distinct on (day.id,account.provider_key) day.id as featured_day_id,
      account.provider_key,day.feature_date
    from public.featured_provider_days day
    join public.featured_provider_slots slot on slot.day_id=day.id
    cross join lateral (select case when slot.provider_organization_id is not null
      then 'organization:'||slot.provider_organization_id::text
      else 'profile:'||slot.provider_profile_id::text end as provider_key) account
    where day.status='PUBLISHED'
      and not exists(select 1 from public.featured_account_rotation_selections existing
        where existing.featured_day_id=day.id and existing.provider_key=account.provider_key)
    order by day.id,account.provider_key
  ), observed as (
    insert into public.featured_account_saved_day_observations
      (featured_day_id,provider_key,feature_date)
    select featured_day_id,provider_key,feature_date from saved
    on conflict do nothing
    returning featured_day_id,provider_key,feature_date
  )
  insert into public.featured_account_rotation_selections
    (round_number,provider_key,featured_day_id,first_feature_date,origin,selected_at)
  select distinct on (observation.provider_key) round_value,observation.provider_key,
    observation.featured_day_id,observation.feature_date,'LEGACY',
    coalesce(day.published_at,day.created_at)
  from observed observation
  join public.featured_provider_days day on day.id=observation.featured_day_id
  order by observation.provider_key,observation.feature_date desc,observation.featured_day_id desc
  on conflict(round_number,provider_key) do nothing;
$new$;
begin
  select pg_get_functiondef('public.generate_managed_featured_days_for_date(date)'::regprocedure)
    into strict definition;
  if length(definition)-length(replace(definition,old_fragment,''))<>length(old_fragment)
    then raise exception 'FEATURED_ACCOUNT_BACKFILL_CONTRACT_DRIFT';end if;
  execute replace(definition,old_fragment,new_fragment);
end $migration$;

commit;
