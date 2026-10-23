-- FEAT-FTR-001: honest automatic-run status and bounded staff overview.
-- Preserve the existing random draw, round ledger, schedule and saved-day rules.
create table public.featured_automation_status (
 singleton boolean primary key default true check(singleton),
 checked_at timestamptz,
 succeeded_at timestamptz,
 outcome text not null default 'NOT_RUN' check(outcome in ('NOT_RUN','READY','PAUSED','FAILED')),
 created_count integer not null default 0,
 skipped_count integer not null default 0,
 empty_count integer not null default 0
);
alter table public.featured_automation_status enable row level security;
revoke all on public.featured_automation_status from public,anon,authenticated,service_role;
grant select on public.featured_automation_status to service_role;
insert into public.featured_automation_status(singleton) values(true);

alter function public.generate_managed_featured_days() rename to generate_managed_featured_days_core;
revoke all on function public.generate_managed_featured_days_core() from public,anon,authenticated,service_role;

create function public.generate_managed_featured_days()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;mode text;
begin
 if not pg_try_advisory_xact_lock(8030180) then
   return jsonb_build_object('ok',true,'busy',true,'created',0,'skipped',0,'empty',0);
 end if;
 -- Exception subtransaction rolls back any partial roster/history before recording failure.
 begin
   result:=public.generate_managed_featured_days_core();
 exception when others then
   update public.featured_automation_status set checked_at=clock_timestamp(),outcome='FAILED',created_count=0,skipped_count=0,empty_count=0 where singleton;
   return jsonb_build_object('ok',false,'created',0,'skipped',0,'empty',0);
 end;
 select featured_mode into mode from public.platform_controls where singleton;
 update public.featured_automation_status set checked_at=clock_timestamp(),
   succeeded_at=case when mode='AUTO' then clock_timestamp() else succeeded_at end,
   outcome=case when mode='AUTO' then 'READY' else 'PAUSED' end,
   created_count=(result->>'created')::integer,skipped_count=(result->>'skipped')::integer,empty_count=(result->>'empty')::integer
 where singleton;
 return result||jsonb_build_object('ok',true);
end $$;
revoke all on function public.generate_managed_featured_days() from public,anon,authenticated;
grant execute on function public.generate_managed_featured_days() to service_role;

create function public.managed_featured_overview(actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare today date:=(now() at time zone 'Africa/Addis_Ababa')::date;configs text[];pool jsonb;current_round bigint;
 total integer;remaining integer;days jsonb;run_status jsonb;
begin
 if not exists(select 1 from public.profiles where id=actor_user_id and active and role='ADMIN') then raise exception 'FORBIDDEN';end if;
 select array_agg(distinct configuration) into configs from generate_series(0,6) offset_value
   cross join lateral jsonb_array_elements_text(public.featured_truck_theme(today+offset_value)->'configurations') configuration;
 select coalesce(max(round_number),1) into current_round from public.featured_rotation_selections;
 select coalesce(jsonb_agg(jsonb_build_object('vehicle_id',e.vehicle_id,'driver_user_id',e.driver_user_id,'configuration',v.cargo_configuration,
   'remaining',not exists(select 1 from public.featured_rotation_selections h where h.round_number=current_round and h.vehicle_id=e.vehicle_id and h.driver_user_id=e.driver_user_id))),'[]'::jsonb)
 into pool from public.featured_eligible_truck_links(configs) e join public.vehicles v on v.id=e.vehicle_id;
 select count(*),count(*) filter(where (value->>'remaining')::boolean) into total,remaining from jsonb_array_elements(pool);
 select jsonb_agg(jsonb_build_object('date',today+offset_value,'theme',theme->>'label','status',d.status,'source',d.selection_source,
   'selected', (select count(*) from public.featured_provider_slots s where s.day_id=d.id),
   'invalid', (select count(*) from public.featured_provider_slots s where s.day_id=d.id and not exists(select 1 from jsonb_array_elements(pool) pair where pair->>'vehicle_id'=s.vehicle_id::text and pair->>'driver_user_id'=s.driver_user_id::text)),
   'eligible', (select count(*) from jsonb_array_elements(pool) pair where (theme->'configurations') ? (pair->>'configuration')),
   'remaining', (select count(*) from jsonb_array_elements(pool) pair where (theme->'configurations') ? (pair->>'configuration') and (pair->>'remaining')::boolean)
 ) order by offset_value) into days
 from generate_series(0,6) offset_value cross join lateral public.featured_truck_theme(today+offset_value) theme
 left join public.featured_provider_days d on d.feature_date=today+offset_value;
 select to_jsonb(s)-'singleton' into run_status from public.featured_automation_status s where singleton;
 return jsonb_build_object('round',current_round,'eligible',total,'remaining',remaining,'days',days,'run',run_status);
end $$;
revoke all on function public.managed_featured_overview(uuid) from public,anon,authenticated;
grant execute on function public.managed_featured_overview(uuid) to service_role;
