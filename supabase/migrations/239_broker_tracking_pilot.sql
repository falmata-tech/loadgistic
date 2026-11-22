-- FEAT-TRK-001. Direct broker routes, private job references and pending request decisions.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.tracking_sessions
 add column broker_reference text check (broker_reference=trim(broker_reference)
   and char_length(broker_reference) between 1 and 80 and broker_reference !~ '[[:cntrl:]]'),
 add column request_resolution text check (request_resolution in ('DECLINED','WITHDRAWN'));
create index tracking_session_broker_reference on public.tracking_sessions(workspace_id,lower(broker_reference))
 where broker_reference is not null;

-- Preserve the installed ACLs, actor locks, link checks and shipment lifecycle.
do $patch$
declare item record; definition text;
begin
 for item in select * from (values
  ('public.create_tracking_session(uuid,jsonb)',
   $old$'workspaceId','route','cargoDescription','pickupDate','deliveryDate'$old$,
   $new$'workspaceId','route','cargoDescription','pickupDate','deliveryDate','brokerReference'$new$),
  ('public.create_tracking_session(uuid,jsonb)',
   $old$jsonb_array_length(requested_route)<>3$old$,
   $new$jsonb_array_length(requested_route) not between 2 and 3$new$),
  ('public.create_tracking_session(uuid,jsonb)',
   $old$insert into public.tracking_sessions(workspace_id,created_by,origin_kind,route,cargo_summary,pickup_date,delivery_date)
 values(workspace,actor_user_id,'BROKER_REQUEST',route,trim(command->>'cargoDescription'),pickup,delivery)$old$,
   $new$if command?'brokerReference' and (jsonb_typeof(command->'brokerReference')<>'string'
    or char_length(trim(command->>'brokerReference'))>80 or command->>'brokerReference' ~ '[[:cntrl:]]')
 then raise exception 'INVALID_TRACKING_INPUT';end if;
 insert into public.tracking_sessions(workspace_id,created_by,origin_kind,route,cargo_summary,pickup_date,delivery_date,broker_reference)
 values(workspace,actor_user_id,'BROKER_REQUEST',route,trim(command->>'cargoDescription'),pickup,delivery,nullif(trim(command->>'brokerReference'),''))$new$),
  ('public.tracking_session_detail(uuid,uuid)',
   $old$'route',s.route,'cargoSummary',s.cargo_summary$old$,
   $new$'brokerReference',case when s.workspace_id is not null
    and public.business_workspace_permission(actor_user_id,s.workspace_id,'TRACKING') then s.broker_reference end,
  'requestExpired',s.state='PENDING_PROVIDER' and s.pending_expires_at<=clock_timestamp(),
  'route',s.route,'cargoSummary',s.cargo_summary$new$),
  ('public.accept_tracking_request(uuid,uuid,bigint,jsonb)',
   $old$'passing_place_ref',s.route->1->>'placeRef','destination_place_ref',s.route->2->>'placeRef'$old$,
   $new$'passing_place_ref',case when jsonb_array_length(s.route)=3 then s.route->1->>'placeRef' end,'destination_place_ref',s.route->(-1)->>'placeRef'$new$),
  ('public.create_tracking_session_shipment(uuid,jsonb)',
   $old$ select * into city from public.place_catalog where id=nullif(trim(command->>'passing_place_ref'),'');$old$,
   $new$ if nullif(trim(command->>'passing_place_ref'),'') is null then
  return public.create_tracking_session_base_no_email(actor_user_id,command);
 end if;
 select * into city from public.place_catalog where id=nullif(trim(command->>'passing_place_ref'),'');$new$)
 ) as patches(signature,expected,replacement)
 loop
  definition:=pg_get_functiondef(item.signature::regprocedure);
  if (length(definition)-length(replace(definition,item.expected,'')))<>length(item.expected)
  then raise exception 'TRACKING_PILOT_FUNCTION_DRIFT: %',item.signature;end if;
  execute replace(definition,item.expected,item.replacement);
 end loop;
end $patch$;

create or replace function public.manage_tracking_request(actor uuid,session_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare s public.tracking_sessions%rowtype; target record; items jsonb; term text:=trim(command->>'query'); action_name text:=command->>'action';
begin
 select * into s from public.tracking_sessions where id=session_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 perform public.tracking229_lock_actor(actor,s);
 if public.tracking229_can_manage(actor,s) is distinct from true then raise exception 'FORBIDDEN';end if;
 if s.state<>'PENDING_PROVIDER' then raise exception 'TRACKING_SESSION_CHANGED';end if;
 if public.tracking229_source_active(s) is distinct from true then
  if action_name='SEARCH' then
   return jsonb_build_object('revision',s.revision,'selected',null,'items','[]'::jsonb,'status','EXPIRED');
  end if;
  raise exception 'TRACKING_SESSION_CHANGED';
 end if;
 case action_name
 when 'SEARCH' then
  if term is null or length(term)>100 then raise exception 'INVALID_TRACKING_INPUT';end if;
  if length(term)>=2 then
   select jsonb_agg(jsonb_build_object('vehicleId',t.vehicle_id,'driverId',t.driver_id,'label',t.label,'connected',t.connected)
    order by t.connected desc,t.label,t.vehicle_id) into items from public.tracking_request_targets(s.workspace_id,term) t;
  end if;
 when 'SELECT' then
  if s.revision is distinct from (command->>'revision')::bigint then raise exception 'TRACKING_SESSION_CHANGED';end if;
  select * into target from public.tracking_request_targets(s.workspace_id,null,(command->>'vehicleId')::uuid);
  if not found or target.driver_id is distinct from (command->>'driverId')::uuid then raise exception 'TRACKING_SESSION_CHANGED';end if;
  update public.tracking_sessions set requested_vehicle_id=target.vehicle_id,requested_driver_id=target.driver_id,
    requested_label=target.label,request_resolution=null,revision=revision+1,updated_at=clock_timestamp() where id=s.id returning * into s;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
   values(actor,'TRACKING_PROVIDER_REQUESTED','tracking_session',s.id,'{}');
 when 'WITHDRAW' then
  if s.revision is distinct from (command->>'revision')::bigint or s.requested_vehicle_id is null
  then raise exception 'TRACKING_SESSION_CHANGED';end if;
  update public.tracking_sessions set requested_vehicle_id=null,requested_driver_id=null,
    requested_label=null,request_resolution='WITHDRAWN',revision=revision+1,updated_at=clock_timestamp() where id=s.id returning * into s;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
   values(actor,'TRACKING_PROVIDER_REQUEST_WITHDRAWN','tracking_session',s.id,'{}');
 else raise exception 'INVALID_TRACKING_INPUT';
 end case;
 return jsonb_build_object('revision',s.revision,'selected',s.requested_label,'items',coalesce(items,'[]'::jsonb),
  'status',coalesce(s.request_resolution,case when s.requested_vehicle_id is null then 'NOT_REQUESTED' else 'REQUESTED' end));
end $$;

create function public.decline_tracking_request(actor_user_id uuid,target_session_id uuid,requested_revision bigint)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare s public.tracking_sessions%rowtype;
begin
 select * into s from public.tracking_sessions where id=target_session_id for update;
 if not found or s.revision is distinct from requested_revision or s.requested_vehicle_id is null
 then raise exception 'TRACKING_ACCESS_DENIED';end if;
 perform 1 from public.vehicles v where v.id=s.requested_vehicle_id for share;
 perform 1 from public.driver_vehicle_assignments a where a.vehicle_id=s.requested_vehicle_id and a.active for share;
 perform 1 from public.driver_permissions p where p.user_id=actor_user_id for share;
 perform 1 from public.profiles p where p.id=actor_user_id for share;
 perform 1 from auth.users u where u.id=actor_user_id for share;
 if public.tracking_request_eligible(actor_user_id,s) is distinct from true then raise exception 'TRACKING_ACCESS_DENIED';end if;
 update public.tracking_sessions set requested_vehicle_id=null,requested_driver_id=null,requested_label=null,
  request_resolution='DECLINED',revision=revision+1,updated_at=clock_timestamp() where id=s.id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(actor_user_id,'TRACKING_PROVIDER_REQUEST_DECLINED','tracking_session',s.id,'{}');
 return true;
end $$;

create function public.tracking_session_reference_search(actor_user_id uuid,target_workspace_id uuid,requested_page integer,requested_reference text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare total integer;page integer;page_count integer;sessions jsonb;term text:=lower(trim(requested_reference));
begin
 if target_workspace_id is null or public.business_workspace_permission(actor_user_id,target_workspace_id,'TRACKING') is distinct from true
 then raise exception 'BUSINESS_FORBIDDEN';end if;
 if term is null or char_length(term) not between 1 and 80 or term ~ '[[:cntrl:]]'
 then raise exception 'INVALID_TRACKING_INPUT';end if;
 select count(*) into total from public.tracking_sessions s
  where s.workspace_id=target_workspace_id and starts_with(lower(s.broker_reference),term)
  and public.tracking229_can_read(actor_user_id,s);
 page_count:=greatest(1,ceil(total/20.0)::integer);
 page:=greatest(1,least(coalesce(requested_page,1),page_count));
 select coalesce(jsonb_agg(public.tracking_session_detail(actor_user_id,s.id) order by s.created_at desc,s.id),'[]'::jsonb)
 into sessions from (
  select s.id,s.created_at from public.tracking_sessions s
  where s.workspace_id=target_workspace_id and starts_with(lower(s.broker_reference),term)
  and public.tracking229_can_read(actor_user_id,s)
  order by s.created_at desc,s.id limit 20 offset(page-1)*20
 ) s;
 return jsonb_build_object('workspaceId',target_workspace_id,'total',total,'page',page,'pageCount',page_count,'sessions',sessions);
end $$;

revoke all on function public.decline_tracking_request(uuid,uuid,bigint),public.tracking_session_reference_search(uuid,uuid,integer,text)
 from public,anon,authenticated;
grant execute on function public.decline_tracking_request(uuid,uuid,bigint),public.tracking_session_reference_search(uuid,uuid,integer,text)
 to service_role;
notify pgrst,'reload schema';
commit;
