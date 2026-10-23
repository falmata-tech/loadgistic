-- FEAT-FTR-001: distinguish the actual TikTok broadcast from the vehicle timetable.

alter table public.featured_provider_days
  add column tiktok_broadcast_status text not null default 'NOT_SCHEDULED',
  add column tiktok_broadcast_started_at timestamptz,
  add constraint featured_provider_days_tiktok_broadcast_status_check
    check (tiktok_broadcast_status in ('NOT_SCHEDULED','SCHEDULED','LIVE','ENDED')),
  add constraint featured_provider_days_tiktok_live_start_check
    check (tiktok_broadcast_status <> 'LIVE' or tiktok_broadcast_started_at is not null),
  add constraint featured_provider_days_tiktok_non_live_start_check
    check (tiktok_broadcast_status not in ('SCHEDULED','NOT_SCHEDULED') or tiktok_broadcast_started_at is null);

update public.featured_provider_days
set tiktok_broadcast_status=case
      when status='PUBLISHED' and nullif(trim(tiktok_url),'') is not null then 'SCHEDULED'
      else 'NOT_SCHEDULED'
    end,
    tiktok_broadcast_started_at=null;

create function public.sync_featured_tiktok_broadcast_state() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE'
    and new.tiktok_url is not distinct from old.tiktok_url
    and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status='PUBLISHED' and nullif(trim(new.tiktok_url),'') is not null then
    new.tiktok_broadcast_status:='SCHEDULED';
  else
    new.tiktok_broadcast_status:='NOT_SCHEDULED';
  end if;
  new.tiktok_broadcast_started_at:=null;
  return new;
end $$;

create trigger sync_featured_tiktok_broadcast_state
before insert or update on public.featured_provider_days
for each row execute function public.sync_featured_tiktok_broadcast_state();

create function public.set_managed_featured_tiktok_broadcast(
  actor_user_id uuid,
  requested_date date,
  requested_state text
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare day_row public.featured_provider_days%rowtype;started_at_value timestamptz;
begin
  perform public.lock_featured_actor(actor_user_id);
  if upper(trim(coalesce(requested_state,''))) not in ('LIVE','ENDED') then
    raise exception 'FEATURED_BROADCAST_STATE_INVALID';
  end if;

  select * into day_row
  from public.featured_provider_days
  where feature_date=requested_date
  for update;
  if not found then raise exception 'FEATURED_DAY_NOT_FOUND'; end if;
  if day_row.status<>'PUBLISHED' then raise exception 'FEATURED_DAY_NOT_PUBLISHED'; end if;
  if nullif(trim(day_row.tiktok_url),'') is null then raise exception 'FEATURED_TIKTOK_REQUIRED'; end if;

  if upper(trim(requested_state))='LIVE' then
    if day_row.tiktok_broadcast_status='ENDED' then raise exception 'FEATURED_BROADCAST_ALREADY_ENDED'; end if;
    if day_row.tiktok_broadcast_status='LIVE' then
      started_at_value:=day_row.tiktok_broadcast_started_at;
    elsif day_row.tiktok_broadcast_status='SCHEDULED' then
      started_at_value:=clock_timestamp();
      update public.featured_provider_days
      set tiktok_broadcast_status='LIVE',tiktok_broadcast_started_at=started_at_value,updated_at=clock_timestamp()
      where id=day_row.id;
    else
      raise exception 'FEATURED_BROADCAST_NOT_SCHEDULED';
    end if;
  else
    started_at_value:=day_row.tiktok_broadcast_started_at;
    if day_row.tiktok_broadcast_status='SCHEDULED' then raise exception 'FEATURED_BROADCAST_NOT_LIVE'; end if;
    if day_row.tiktok_broadcast_status='LIVE' then
      update public.featured_provider_days
      set tiktok_broadcast_status='ENDED',updated_at=clock_timestamp()
      where id=day_row.id;
    elsif day_row.tiktok_broadcast_status<>'ENDED' then
      raise exception 'FEATURED_BROADCAST_NOT_LIVE';
    end if;
  end if;

  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,'FEATURED_TIKTOK_BROADCAST_UPDATED','featured_provider_day',day_row.id,
    jsonb_build_object('featureDate',requested_date,'state',upper(trim(requested_state))),clock_timestamp());

  return jsonb_build_object('feature_date',requested_date,'status',upper(trim(requested_state)),
    'started_at',started_at_value);
end $$;

revoke all on function public.sync_featured_tiktok_broadcast_state() from public,anon,authenticated;
revoke all on function public.set_managed_featured_tiktok_broadcast(uuid,date,text) from public,anon,authenticated;
grant execute on function public.set_managed_featured_tiktok_broadcast(uuid,date,text) to service_role;

comment on column public.featured_provider_days.tiktok_broadcast_status is
  'SCHEDULED/LIVE/ENDED are an explicit staff-managed TikTok state; timetable phase alone never means TikTok is live.';
