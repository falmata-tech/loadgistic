-- FEAT-FTR-001: exact truck-and-Driver featured roster and one morning programme.

alter table public.featured_provider_days
  add column if not exists target_count integer not null default 8
    check (target_count between 1 and 12);

alter table public.featured_provider_slots
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete cascade,
  add column if not exists driver_user_id uuid references public.profiles(id) on delete restrict;

-- A fleet may feature more than one distinct truck. The exact vehicle, not its
-- owning provider, is the roster identity for this programme.
drop index if exists public.idx_featured_slot_day_org;
drop index if exists public.idx_featured_slot_day_profile;
drop function if exists public.save_managed_featured_day(uuid,jsonb);

-- Existing rows are disposable demonstration provider rosters. They cannot be
-- safely guessed into exact truck-and-Driver selections.
delete from public.featured_provider_slots
where vehicle_id is null or driver_user_id is null;

-- Retire the former all-day/two-session configuration. Existing demo days
-- return to draft because their provider-only slots were intentionally removed.
update public.featured_provider_days
set broadcast_start_time='07:30'::time,
    broadcast_end_time='09:00'::time,
    schedule_mode='AUTO',
    schedule_config_json=jsonb_build_object(
      'dayStart','07:30','dayEnd','09:00','targetCount',8,
      'sponsorBreakEvery',2,'sponsorBreakMinutes',2
    ),
    manual_schedule_json='[]'::jsonb,
    target_count=8,
    status='DRAFT',
    published_by=null,
    published_at=null,
    updated_at=now();

alter table public.featured_provider_slots
  drop constraint if exists featured_provider_slots_vehicle_driver_required,
  add constraint featured_provider_slots_vehicle_driver_required
    check (vehicle_id is not null and driver_user_id is not null);

create unique index if not exists idx_featured_slot_day_vehicle
  on public.featured_provider_slots(day_id,vehicle_id);

create or replace function public.save_managed_featured_truck_day(actor_user_id uuid,command jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  feature_date_value date;theme_key text;theme_label text;status_value text;schedule_mode_value text;
  headline_value text;introduction_value text;tiktok_value text;truck_keys jsonb;theme_configurations text[];
  target_count_value integer;truck_key text;vehicle_value uuid;driver_value uuid;saved_day_id uuid;position_value integer:=0;
  vehicle_record public.vehicles%rowtype;page_record public.company_pages%rowtype;
begin
  if not exists(select 1 from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text='ADMIN') then raise exception 'FORBIDDEN'; end if;
  begin
    feature_date_value:=(command->>'feature_date')::date;
    target_count_value:=(command->>'target_count')::integer;
  exception when others then raise exception 'FEATURED_DATE_INVALID'; end;
  if target_count_value not between 1 and 12 then raise exception 'FEATURED_TARGET_COUNT_INVALID'; end if;
  theme_key:=left(trim(coalesce(command->>'theme_key','')),80);theme_label:=left(trim(coalesce(command->>'theme_label','')),160);
  if theme_key='' or theme_label='' then raise exception 'FEATURED_TRUCK_THEME_INVALID'; end if;
  select coalesce(array_agg(value),array[]::text[]) into theme_configurations from jsonb_array_elements_text(coalesce(command->'theme_configurations','[]'::jsonb)) value;
  if cardinality(theme_configurations)=0 then raise exception 'FEATURED_TRUCK_THEME_INVALID'; end if;
  truck_keys:=coalesce(command->'truck_keys','[]'::jsonb);
  if jsonb_typeof(truck_keys)<>'array' then raise exception 'FEATURED_TRUCK_INVALID'; end if;
  if (select count(*)<>count(distinct value) from jsonb_array_elements_text(truck_keys) value) then raise exception 'FEATURED_TRUCK_DUPLICATE'; end if;
  status_value:=case when coalesce((command->>'publish')::boolean,false) then 'PUBLISHED' else 'DRAFT' end;
  if status_value='PUBLISHED' and jsonb_array_length(truck_keys)<>target_count_value then raise exception 'FEATURED_TARGET_COUNT_MISMATCH'; end if;
  schedule_mode_value:=upper(trim(coalesce(command->>'schedule_mode','AUTO')));
  if schedule_mode_value not in ('AUTO','MANUAL') then raise exception 'FEATURED_SCHEDULE_MODE_INVALID'; end if;
  headline_value:=nullif(left(trim(coalesce(command->>'public_headline','')),90),'');
  introduction_value:=nullif(left(trim(coalesce(command->>'public_introduction','')),240),'');
  tiktok_value:=nullif(trim(coalesce(command->>'tiktok_url','')),'');
  if tiktok_value is not null and tiktok_value !~* '^https://([a-z0-9-]+\.)*tiktok\.com(/|$)' then raise exception 'FEATURED_TIKTOK_URL_INVALID'; end if;

  insert into public.featured_provider_days(id,feature_date,base_place_ref,base_place_label,expo_group_key,expo_group_label,
    expo_region_codes,public_headline,public_introduction,tiktok_url,broadcast_start_time,broadcast_end_time,
    schedule_mode,schedule_config_json,manual_schedule_json,target_count,status,created_by,published_by,created_at,updated_at,published_at)
  values(gen_random_uuid(),feature_date_value,'featured:'||theme_key,theme_label,theme_key,theme_label,'[]'::jsonb,
    headline_value,introduction_value,tiktok_value,'07:30'::time,'09:00'::time,schedule_mode_value,command->'schedule_config',
    coalesce(command->'manual_schedule','[]'::jsonb),target_count_value,status_value,actor_user_id,
    case when status_value='PUBLISHED' then actor_user_id end,now(),now(),case when status_value='PUBLISHED' then now() end)
  on conflict on constraint featured_provider_days_feature_date_key do update set
    base_place_ref=excluded.base_place_ref,base_place_label=excluded.base_place_label,expo_group_key=excluded.expo_group_key,
    expo_group_label=excluded.expo_group_label,expo_region_codes=excluded.expo_region_codes,
    public_headline=excluded.public_headline,public_introduction=excluded.public_introduction,tiktok_url=excluded.tiktok_url,
    broadcast_start_time=excluded.broadcast_start_time,broadcast_end_time=excluded.broadcast_end_time,
    schedule_mode=excluded.schedule_mode,schedule_config_json=excluded.schedule_config_json,
    manual_schedule_json=excluded.manual_schedule_json,target_count=excluded.target_count,status=excluded.status,
    published_by=excluded.published_by,updated_at=excluded.updated_at,published_at=excluded.published_at
  returning id into saved_day_id;

  delete from public.featured_provider_slots slot where slot.day_id=saved_day_id;
  for truck_key in select value from jsonb_array_elements_text(truck_keys) value loop
    begin vehicle_value:=replace(truck_key,'vehicle:','')::uuid;exception when others then raise exception 'FEATURED_TRUCK_INVALID'; end;
    select vehicle.* into vehicle_record from public.vehicles vehicle
      where vehicle.id=vehicle_value and vehicle.active and vehicle.cargo_configuration=any(theme_configurations);
    if not found then raise exception 'FEATURED_TRUCK_INVALID'; end if;
    select assignment.driver_user_id into driver_value
      from public.driver_vehicle_assignments assignment
      join public.profiles driver_profile on driver_profile.id=assignment.driver_user_id and driver_profile.active
      left join public.drivers fleet_driver on fleet_driver.user_id=assignment.driver_user_id
      where assignment.vehicle_id=vehicle_record.id and assignment.active
        and (vehicle_record.organization_id is null or coalesce(fleet_driver.active,false))
      order by assignment.assigned_at desc,assignment.id desc limit 1;
    if driver_value is null then raise exception 'FEATURED_DRIVER_REQUIRED'; end if;
    select page.* into page_record from public.company_pages page
      where page.published and (page.organization_id=vehicle_record.organization_id or page.provider_profile_id=vehicle_record.provider_profile_id)
        and ((page.show_contact_phone and nullif(trim(page.contact_phone),'') is not null)
          or (page.show_contact_whatsapp and nullif(trim(page.contact_whatsapp),'') is not null)
          or (page.show_contact_email and nullif(trim(page.contact_email),'') is not null)
          or (page.show_contact_website and nullif(trim(page.contact_website),'') is not null));
    if not found then raise exception 'FEATURED_TRUCK_INELIGIBLE'; end if;
    position_value:=position_value+1;
    insert into public.featured_provider_slots(id,day_id,slot_position,provider_organization_id,provider_profile_id,vehicle_id,driver_user_id,created_by,created_at)
    values(gen_random_uuid(),saved_day_id,position_value,vehicle_record.organization_id,vehicle_record.provider_profile_id,vehicle_record.id,driver_value,actor_user_id,now());
  end loop;
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,case when status_value='PUBLISHED' then 'FEATURED_DAY_PUBLISHED' else 'FEATURED_DAY_SAVED' end,
    'featured_truck_day',saved_day_id,jsonb_build_object('featureDate',feature_date_value,'theme',theme_key,
      'truckCount',jsonb_array_length(truck_keys),'targetCount',target_count_value,'scheduleMode',schedule_mode_value),now());
  return saved_day_id;
end;
$$;

revoke all on function public.save_managed_featured_truck_day(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_managed_featured_truck_day(uuid,jsonb) to service_role;

comment on column public.featured_provider_slots.vehicle_id is 'Exact public featured truck selected by an administrator.';
comment on column public.featured_provider_slots.driver_user_id is 'Driver assignment rechecked when the featured day is saved and projected.';
