-- FEAT-SHR-001: sharing policy is server authority, never recipient metadata in a public row.
-- Additive. Existing access is backfilled; grants and historical capacities are retained.
create table public.vehicle_capacity_sharing (
 vehicle_id uuid primary key references public.vehicles(id),
 mode text not null check(mode in ('PUBLIC','PRIVATE','BOTH','EXCLUSIVE')),
 exclusive_email text,
 exclusive_digest text,
 updated_by uuid references public.profiles(id),
 updated_at timestamptz not null default now(),
 constraint exclusive_recipient_required check(
  (mode='EXCLUSIVE' and exclusive_email is not null and exclusive_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   and exclusive_digest is not null and exclusive_digest ~ '^[a-f0-9]{64}$')
  or (mode<>'EXCLUSIVE' and exclusive_email is null and exclusive_digest is null))
);
alter table public.vehicle_capacity_sharing enable row level security;
revoke all on public.vehicle_capacity_sharing from public,anon,authenticated;
grant select,insert,update,delete on public.vehicle_capacity_sharing to service_role;
insert into public.vehicle_capacity_sharing(vehicle_id,mode)
select vehicle.id,case when latest.visibility='OPEN' then
 case when exists(select 1 from public.capacity_access_grants g where g.vehicle_id=vehicle.id and g.revoked_at is null
 and (g.expires_at is null or g.expires_at>now())) then 'BOTH' else 'PUBLIC' end else 'PRIVATE' end
from public.vehicles vehicle left join lateral(select c.visibility from public.capacities c where c.vehicle_id=vehicle.id
 order by c.updated_at desc,c.id desc limit 1) latest on true;

create function public.capacity_sharing_mode(target_vehicle_id uuid) returns text language sql stable security definer
set search_path=public,pg_temp as $$
 select coalesce((select mode from public.vehicle_capacity_sharing where vehicle_id=target_vehicle_id),'PRIVATE')
$$;
create function public.capacity_sharing_allows(target_vehicle_id uuid,audience text,recipient_digest text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.vehicles v left join public.vehicle_capacity_sharing p on p.vehicle_id=v.id
 where v.id=target_vehicle_id and v.active and
 (coalesce(p.mode,'PRIVATE') in ('PRIVATE','BOTH') or p.mode='EXCLUSIVE' and audience='EMAIL' and p.exclusive_digest=recipient_digest))
$$;
create function public.set_provider_capacity_sharing(actor_user_id uuid,target_vehicle_id uuid,sharing_mode text,
 normalized_exclusive_email text default null,recipient_digest text default null) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare previous public.vehicle_capacity_sharing%rowtype;
 clean_email text:=lower(trim(normalized_exclusive_email));
 mode_value text:=upper(trim(sharing_mode));
begin
 if not public.private_capacity_actor_controls_vehicle(actor_user_id,target_vehicle_id) then raise exception 'NOT_FOUND'; end if;
 perform 1 from public.vehicles where id=target_vehicle_id and active for update;
 if not found or not public.private_capacity_actor_controls_vehicle(actor_user_id,target_vehicle_id) then raise exception 'NOT_FOUND'; end if;
 if mode_value is null or mode_value not in ('PUBLIC','PRIVATE','BOTH','EXCLUSIVE') then raise exception 'INVALID_SHARING_MODE'; end if;
 select * into previous from public.vehicle_capacity_sharing where vehicle_id=target_vehicle_id;
 if mode_value='EXCLUSIVE' and (clean_email is null or length(clean_email)>254 or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or recipient_digest is null or recipient_digest !~ '^[a-f0-9]{64}$') then raise exception 'EXCLUSIVE_EMAIL_REQUIRED'; end if;
 insert into public.vehicle_capacity_sharing(vehicle_id,mode,exclusive_email,exclusive_digest,updated_by)
 values(target_vehicle_id,mode_value,case when mode_value='EXCLUSIVE' then clean_email end,
 case when mode_value='EXCLUSIVE' then recipient_digest end,actor_user_id)
 on conflict(vehicle_id) do update set mode=excluded.mode,exclusive_email=excluded.exclusive_email,
 exclusive_digest=excluded.exclusive_digest,updated_by=excluded.updated_by,updated_at=now();
 -- An unrelated save of the same policy must not resurrect a revoked invitation.
 if mode_value='EXCLUSIVE' and (previous.mode is distinct from mode_value or previous.exclusive_digest is distinct from recipient_digest) then
  perform public.grant_private_capacity_access(actor_user_id,target_vehicle_id,clean_email,recipient_digest);
 end if;
 update public.capacities set visibility=(case when mode_value in ('PUBLIC','BOTH') then 'OPEN' else 'PRIVATE' end)::public.capacity_visibility
 where id=(select c.id from public.capacities c where c.vehicle_id=target_vehicle_id order by c.updated_at desc,c.id desc limit 1);
 if previous.mode is distinct from mode_value or previous.exclusive_digest is distinct from (case when mode_value='EXCLUSIVE' then recipient_digest end) then
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details)
  values(gen_random_uuid(),actor_user_id,'CAPACITY_SHARING_CHANGED','vehicle',target_vehicle_id,
  jsonb_build_object('previousMode',previous.mode,'mode',mode_value));
 end if;
 return mode_value;
end;
$$;
revoke all on function public.capacity_sharing_mode(uuid),public.capacity_sharing_allows(uuid,text,text),
 public.set_provider_capacity_sharing(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.capacity_sharing_mode(uuid),public.capacity_sharing_allows(uuid,text,text),
 public.set_provider_capacity_sharing(uuid,uuid,text,text,text) to service_role;

-- Patch only guarded fragments of current functions; do not replace newer permissions/workflow code.
do $migration$
declare definition text; signature text; before_text text; after_text text;
begin
 signature:='grant_private_capacity_access(uuid,uuid,text,text)';
 before_text:=$before$  select * into existing from public.capacity_access_grants grant_record
  where grant_record.vehicle_id=target_vehicle_id and grant_record.audience_type='EMAIL'
    and grant_record.recipient_email_digest=recipient_digest and grant_record.revoked_at is null
  for update;$before$;
 after_text:=$after$  perform 1 from public.vehicles where id=target_vehicle_id and active for update;
  if not public.private_capacity_actor_controls_vehicle(actor_user_id,target_vehicle_id) then raise exception 'NOT_FOUND'; end if;
  if public.capacity_sharing_mode(target_vehicle_id)='EXCLUSIVE' and not public.capacity_sharing_allows(target_vehicle_id,'EMAIL',recipient_digest) then
   raise exception 'EXCLUSIVE_RECIPIENT_ONLY';
  end if;
  if public.capacity_sharing_mode(target_vehicle_id)='PUBLIC' then
   perform public.set_provider_capacity_sharing(actor_user_id,target_vehicle_id,'BOTH');
  end if;
  select * into existing from public.capacity_access_grants grant_record
  where grant_record.vehicle_id=target_vehicle_id and grant_record.audience_type='EMAIL'
    and grant_record.recipient_email_digest=recipient_digest and grant_record.revoked_at is null
  for update;$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='set_loadgistic_capacity_access(uuid,uuid,boolean,text)';
 before_text:=$before$  select * into existing from public.capacity_access_grants grant_record
  where grant_record.vehicle_id=target_vehicle_id and grant_record.audience_type='LOADGISTIC'
    and grant_record.recipient_email_digest=platform_digest and grant_record.revoked_at is null
  for update;$before$;
 after_text:=$after$  perform 1 from public.vehicles where id=target_vehicle_id and active for update;
  if not public.private_capacity_actor_controls_vehicle(actor_user_id,target_vehicle_id) then raise exception 'NOT_FOUND'; end if;
  if enabled and public.capacity_sharing_mode(target_vehicle_id)='EXCLUSIVE' then raise exception 'EXCLUSIVE_RECIPIENT_ONLY'; end if;
  if enabled and public.capacity_sharing_mode(target_vehicle_id)='PUBLIC' then
   perform public.set_provider_capacity_sharing(actor_user_id,target_vehicle_id,'BOTH');
  end if;
  select * into existing from public.capacity_access_grants grant_record
  where grant_record.vehicle_id=target_vehicle_id and grant_record.audience_type='LOADGISTIC'
    and grant_record.recipient_email_digest=platform_digest and grant_record.revoked_at is null
  for update;$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='revoke_private_capacity_access(uuid,uuid)';
 before_text:=$before$  select * into grant_record from public.capacity_access_grants where id=target_grant_id for update;$before$;
 after_text:=$after$  select * into grant_record from public.capacity_access_grants where id=target_grant_id;
  if not found or not public.private_capacity_actor_controls_vehicle(actor_user_id,grant_record.vehicle_id) then raise exception 'NOT_FOUND'; end if;
  perform 1 from public.vehicles where id=grant_record.vehicle_id for update;
  select * into grant_record from public.capacity_access_grants where id=target_grant_id for update;$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='request_shared_capacity_otp(uuid,text,text,text,timestamp with time zone)';
 before_text:=$before$where grant_record.audience_type='EMAIL'$before$;
 after_text:=$after$where public.capacity_sharing_allows(grant_record.vehicle_id,'EMAIL',recipient_digest) and grant_record.audience_type='EMAIL'$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='consume_shared_capacity_otp(text,text)';
 before_text:=$before$where grant_record.audience_type='EMAIL'$before$;
 after_text:=$after$where public.capacity_sharing_allows(grant_record.vehicle_id,'EMAIL',recipient_digest) and grant_record.audience_type='EMAIL'$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='private_capacity_projection(text,text,uuid,timestamp with time zone,uuid,integer)';
 before_text:=$before$where grant_record.audience_type=upper(requested_audience)$before$;
 after_text:=$after$where public.capacity_sharing_allows(grant_record.vehicle_id,upper(requested_audience),requested_digest) and grant_record.audience_type=upper(requested_audience)$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='private_capacity_projection(text,text,uuid,timestamp with time zone,uuid,integer)';
 before_text:=$before$'id',capacity.id,'vehicle_id',capacity.vehicle_id,$before$;
 after_text:=$after$'id',capacity.id,'vehicle_id',capacity.vehicle_id,'sharing_mode',public.capacity_sharing_mode(capacity.vehicle_id),$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='private_capacity_filtered_page(text,text,uuid,timestamp with time zone,uuid,integer,jsonb)';
 before_text:=$before$where grant_record.audience_type=upper(requested_audience)$before$;
 after_text:=$after$where public.capacity_sharing_allows(grant_record.vehicle_id,upper(requested_audience),requested_digest) and grant_record.audience_type=upper(requested_audience)$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='private_capacity_filtered_page(text,text,uuid,timestamp with time zone,uuid,integer,jsonb)';
 before_text:=$before$'id',capacity.id,'vehicle_id',capacity.vehicle_id,$before$;
 after_text:=$after$'id',capacity.id,'vehicle_id',capacity.vehicle_id,'sharing_mode',public.capacity_sharing_mode(capacity.vehicle_id),$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='capacity_search_private_rows(text,text,uuid,timestamp with time zone,uuid,integer,jsonb)';
 before_text:=$before$where grant_record.audience_type=upper(requested_audience)$before$;
 after_text:=$after$where public.capacity_sharing_allows(grant_record.vehicle_id,upper(requested_audience),requested_digest) and grant_record.audience_type=upper(requested_audience)$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='capacity_search_private_rows(text,text,uuid,timestamp with time zone,uuid,integer,jsonb)';
 before_text:=$before$'id',capacity.id,'vehicle_id',capacity.vehicle_id,$before$;
 after_text:=$after$'id',capacity.id,'vehicle_id',capacity.vehicle_id,'sharing_mode',public.capacity_sharing_mode(capacity.vehicle_id),$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='public_capacity_page(jsonb,timestamp with time zone,uuid,integer)';
 before_text:=$before$and candidate.visibility='OPEN' and (not (query ? 'viewport')$before$;
 after_text:=$after$and candidate.visibility='OPEN' and public.capacity_sharing_mode(candidate.vehicle_id) in ('PUBLIC','BOTH') and (not (query ? 'viewport')$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='public_capacity_page(jsonb,timestamp with time zone,uuid,integer)';
 before_text:=$before$'provider_profile_id',provider_profile_id,'status',coalesce(market_status,status::text),$before$;
 after_text:=$after$'provider_profile_id',provider_profile_id,'sharing_mode',public.capacity_sharing_mode(vehicle_id),'status',coalesce(market_status,status::text),$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='capacity_search_public_rows(jsonb,timestamp with time zone,uuid,integer)';
 before_text:=$before$and candidate.visibility='OPEN' and (not (query ? 'viewport')$before$;
 after_text:=$after$and candidate.visibility='OPEN' and public.capacity_sharing_mode(candidate.vehicle_id) in ('PUBLIC','BOTH') and (not (query ? 'viewport')$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='capacity_search_public_rows(jsonb,timestamp with time zone,uuid,integer)';
 before_text:=$before$'provider_profile_id',provider_profile_id,'status',coalesce(market_status,status::text),$before$;
 after_text:=$after$'provider_profile_id',provider_profile_id,'sharing_mode',public.capacity_sharing_mode(vehicle_id),'status',coalesce(market_status,status::text),$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='private_capacity_network(uuid)';
 before_text:=$before$'id',vehicle.id,$before$;
 after_text:=$after$'id',vehicle.id,'sharing_mode',public.capacity_sharing_mode(vehicle.id),'exclusive_email',(select p.exclusive_email from public.vehicle_capacity_sharing p where p.vehicle_id=vehicle.id),$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='provider_capacity_workspace(uuid)';
 before_text:=$before$'visibility',capacity.visibility,'updated_at',capacity.updated_at,$before$;
 after_text:=$after$'visibility',capacity.visibility,'sharing_mode',public.capacity_sharing_mode(capacity.vehicle_id),'exclusive_email',(select p.exclusive_email from public.vehicle_capacity_sharing p where p.vehicle_id=capacity.vehicle_id),'updated_at',capacity.updated_at,$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
 signature:='publish_provider_capacity(uuid,jsonb)';
 before_text:=$before$  if status_value='EMPTY' then$before$;
 after_text:=$after$  -- Preserve restrictive policies for old clients saving unrelated signal fields.
  if command ? 'sharing_mode' then
    perform public.set_provider_capacity_sharing(actor_user_id,vehicle.id,command->>'sharing_mode',command->>'exclusive_email',command->>'exclusive_digest');
  elsif vehicle.id is not null and public.capacity_sharing_mode(vehicle.id)<>'EXCLUSIVE' then
    perform public.set_provider_capacity_sharing(actor_user_id,vehicle.id,
     case when visibility_value='OPEN' then case when exists(select 1 from public.capacity_access_grants g where g.vehicle_id=vehicle.id
      and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())) then 'BOTH' else 'PUBLIC' end else 'PRIVATE' end);
  end if;
  visibility_value:=case when public.capacity_sharing_mode(vehicle.id) in ('PUBLIC','BOTH') then 'OPEN' else 'PRIVATE' end;

  if status_value='EMPTY' then$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'SHARING_FUNCTION_DRIFT: %',signature; end if;
 execute replace(definition,before_text,after_text);
end;
$migration$;
