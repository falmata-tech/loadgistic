-- FEAT-TRK-001. Viewing credentials never designate an operational provider.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.tracking_sessions
 add column requested_vehicle_id uuid references public.vehicles(id),
 add column requested_driver_id uuid references public.profiles(id),
 add column requested_label text,
 add constraint tracking_request_pair check (
   (requested_vehicle_id is null)=(requested_driver_id is null)
   and (requested_vehicle_id is null)=(requested_label is null));
create index tracking_incoming_vehicle on public.tracking_sessions(requested_vehicle_id)
 where state='PENDING_PROVIDER' and requested_vehicle_id is not null;

create function public.tracking_request_targets(workspace uuid,term text,exact_vehicle uuid default null)
returns table(vehicle_id uuid, driver_id uuid, label text, connected boolean)
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select v.id,d.id,concat_ws(' · ',v.platform_number,nullif(public.public_person_first_name(d.id),''),identity.summary->>'name'),
   exists(select 1 from public.account_connections c where c.status='ACCEPTED' and
    ((c.requester_kind,c.requester_id)=('BUSINESS',workspace) and
       ((c.recipient_kind,c.recipient_id)=(owner.kind,owner.id) or (c.recipient_kind,c.recipient_id)=('DRIVER',d.id))
     or (c.recipient_kind,c.recipient_id)=('BUSINESS',workspace) and
       ((c.requester_kind,c.requester_id)=(owner.kind,owner.id) or (c.requester_kind,c.requester_id)=('DRIVER',d.id)))) as connected
 from public.vehicles v
 join public.profiles d on d.id=public.capacity_active_driver_id(v.id) and d.active
 join public.business_workspaces w on w.id=workspace and w.active
 cross join lateral(values(case when v.organization_id is not null then 'ORGANIZATION' else 'PROVIDER_PROFILE' end,coalesce(v.organization_id,v.provider_profile_id))) owner(kind,id)
 cross join lateral(select public.directory_account_summary(owner.kind,owner.id) as summary) identity
 where v.active and (exact_vehicle is null or v.id=exact_vehicle)
 and w.review_workspace=public.business_vehicle_review_scope(v.id)
 and ((v.publication_status='LIVE' and identity.summary is not null)
  or exists(select 1 from public.account_capacity_grants g where g.vehicle_id=v.id
   and g.recipient_kind='BUSINESS' and g.recipient_id=workspace and public.account_capacity_grant_valid(g.id)))
 and (exact_vehicle is not null or position(lower(term) in lower(concat_ws(' ',v.platform_number,
  public.public_person_first_name(d.id),identity.summary->>'name',identity.summary->>'handle')))>0)
 order by connected desc, v.platform_number,v.id limit 25
$$;

create function public.tracking_request_eligible(actor uuid,s public.tracking_sessions)
returns boolean language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select s.state='PENDING_PROVIDER' and public.tracking229_source_active(s)
 and s.requested_driver_id=public.capacity_active_driver_id(s.requested_vehicle_id)
 and (s.requested_driver_id=actor or public.fleet_actor_can_use_vehicle(actor,s.requested_vehicle_id,true))
 and public.fleet_actor_can_use_vehicle(actor,s.requested_vehicle_id,false)
 and exists(select 1 from public.provider_tracking_actor_scope(actor) a where a.can_manage_tracking and a.workspace_access)
$$;

create function public.manage_tracking_request(actor uuid,session_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare s public.tracking_sessions%rowtype; target record; items jsonb; term text:=trim(command->>'query');
begin
 select * into s from public.tracking_sessions where id=session_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 perform public.tracking229_lock_actor(actor,s);
 if public.tracking229_can_manage(actor,s) is distinct from true then raise exception 'FORBIDDEN';end if;
 if s.state<>'PENDING_PROVIDER' or public.tracking229_source_active(s) is distinct from true then raise exception 'TRACKING_SESSION_CHANGED';end if;
 if command->>'action'='SEARCH' then
  if term is null or length(term)>100 then raise exception 'INVALID_TRACKING_INPUT';end if;
  if length(term)>=2 then
   select jsonb_agg(jsonb_build_object('vehicleId',t.vehicle_id,'driverId',t.driver_id,'label',t.label,'connected',t.connected) order by t.connected desc,t.label,t.vehicle_id)
   into items from public.tracking_request_targets(s.workspace_id,term) t;
  end if;
 elsif command->>'action'='SELECT' then
  if s.revision is distinct from (command->>'revision')::bigint then raise exception 'TRACKING_SESSION_CHANGED';end if;
  select * into target from public.tracking_request_targets(s.workspace_id,null,(command->>'vehicleId')::uuid);
  if not found or target.driver_id is distinct from (command->>'driverId')::uuid then raise exception 'TRACKING_SESSION_CHANGED';end if;
  update public.tracking_sessions set requested_vehicle_id=target.vehicle_id,requested_driver_id=target.driver_id,
    requested_label=target.label,revision=revision+1,updated_at=clock_timestamp() where id=s.id returning * into s;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
   values(actor,'TRACKING_PROVIDER_REQUESTED','tracking_session',s.id,'{}');
 else raise exception 'INVALID_TRACKING_INPUT';end if;
 return jsonb_build_object('revision',s.revision,'selected',s.requested_label,'items',coalesce(items,'[]'::jsonb));
end $$;

create function public.incoming_tracking_requests(actor uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select coalesce(jsonb_agg(row_to_json(r) order by r."updatedAt" desc,r.id),'[]'::jsonb) from (
  select s.id,s.reference,s.cargo_summary as cargo,s.requested_label as vehicle,s.route,
   s.pickup_date as "pickupDate",s.delivery_date as "deliveryDate",s.revision,s.updated_at as "updatedAt",
   w.name as broker
  from public.tracking_sessions s join public.business_workspaces w on w.id=s.workspace_id and w.active
  where s.state='PENDING_PROVIDER' and s.requested_vehicle_id is not null and public.tracking_request_eligible(actor,s)
  order by s.updated_at desc,s.id limit 50) r
$$;

create function public.accept_tracking_request(actor_user_id uuid,target_session_id uuid,requested_revision bigint,command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare s public.tracking_sessions%rowtype;created jsonb;mode text;new_id uuid:=gen_random_uuid();native_command jsonb;workspace_review boolean;actual_owner uuid;
begin
 select *into s from public.tracking_sessions where id=target_session_id for update;
 if not found then raise exception 'TRACKING_ACCESS_DENIED';end if;
 perform 1 from public.vehicles v where v.id=s.requested_vehicle_id for share;
 perform 1 from public.driver_vehicle_assignments a where a.vehicle_id=s.requested_vehicle_id and a.active for share;
 perform 1 from public.driver_permissions p where p.user_id=actor_user_id for share;
 if s.revision is distinct from requested_revision or public.tracking_request_eligible(actor_user_id,s) is distinct from true then raise exception 'TRACKING_ACCESS_DENIED';end if;
 if s.state<>'PENDING_PROVIDER' then raise exception 'TRACKING_SESSION_ALREADY_CONNECTED';end if;
 if command is null or jsonb_typeof(command)<>'object' or exists(select 1 from jsonb_object_keys(command) k where k<>'trackingMode') then raise exception 'INVALID_TRACKING_INPUT';end if;
 mode:=command->>'trackingMode';if mode is null or mode not in('STATUS_ONLY','LOCATION_AND_STATUS')then raise exception 'INVALID_TRACKING_MODE';end if;
 perform 1 from public.profiles p where p.id=actor_user_id for share;
 perform 1 from auth.users u where u.id=actor_user_id for share;
 perform 1 from public.business_workspaces w where w.id=s.workspace_id and w.active for share;
 if not found then raise exception 'BUSINESS_FORBIDDEN';end if;
 select m.user_id into actual_owner from public.business_workspace_members m join auth.users u on u.id=m.user_id
  join public.profiles p on p.id=m.user_id where m.workspace_id=s.workspace_id and m.active and m.role='OWNER'
  and public.business_workspace_permission(m.user_id,s.workspace_id,'TRACKING') for share of m,u,p;
 if actual_owner is null or(select count(*)from public.business_workspace_members m where m.workspace_id=s.workspace_id and m.active and m.role='OWNER')<>1 then raise exception 'BUSINESS_FORBIDDEN';end if;
 native_command:=jsonb_build_object('id',new_id,'code','LGX-'||upper(left(replace(gen_random_uuid()::text,'-',''),8)),
  'vehicle_id',s.requested_vehicle_id,'origin_place_ref',s.route->0->>'placeRef','passing_place_ref',s.route->1->>'placeRef','destination_place_ref',s.route->2->>'placeRef',
  'cargo_summary',s.cargo_summary,'expected_pickup_date',s.pickup_date,'expected_delivery_date',s.delivery_date,'tracking_mode',mode);
 perform pg_advisory_xact_lock(hashtextextended('tracking-session-bind:'||new_id::text,0));
 created:=public.create_tracking_session_shipment(actor_user_id,native_command);
 if public.capacity_active_driver_id(s.requested_vehicle_id) is distinct from s.requested_driver_id
 or not exists(select 1 from public.provider_shipments where id=new_id and assigned_vehicle_id=s.requested_vehicle_id and assigned_driver_user_id=s.requested_driver_id)
 then raise exception 'TRACKING_SESSION_CHANGED';end if;
 select w.review_workspace into workspace_review from public.business_workspaces w where w.id=s.workspace_id;
 if public.business_shipment_review_scope(new_id) is distinct from workspace_review then raise exception 'REVIEW_WORKSPACE_ONLY';end if;
 update public.tracking_sessions set state='CONNECTED',shipment_id=new_id,owner_user_id=actual_owner,provider_connected_by=actor_user_id,provider_location_consent=mode='LOCATION_AND_STATUS',revision=revision+1,updated_at=clock_timestamp() where id=s.id;
 return public.tracking_session_detail(actor_user_id,s.id);
exception when invalid_text_representation then raise exception 'INVALID_TRACKING_INPUT';
end $$;

create or replace function public.connect_tracking_session(actor_user_id uuid,target_session_id uuid,link_digest text,code_digest text,command jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin raise exception 'TRACKING_ACCESS_DENIED';end $$;

do $defaults$
declare item record;fn text;
begin
 for item in select * from(values
 ('public.fleet_register_driver(uuid,uuid,jsonb)','values(target_user_id,false,false,false,false,false,actor_user_id)','values(target_user_id,false,false,false,false,true,actor_user_id)'),
 ('public.fleet_accept_invitation(uuid,uuid)','values(actor_user_id,false,false,false,false,false,i.invited_by)','values(actor_user_id,false,false,false,false,true,i.invited_by)'))
 t(signature,old_text,new_text) loop
  fn:=pg_get_functiondef(item.signature::regprocedure);
  if (length(fn)-length(replace(fn,item.old_text,'')))<>length(item.old_text) then raise exception 'TRACKING_DRIVER_DEFAULT_DRIFT';end if;
  execute replace(fn,item.old_text,item.new_text);
 end loop;
end $defaults$;
revoke all on function public.tracking_request_targets(uuid,text,uuid),public.tracking_request_eligible(uuid,public.tracking_sessions),
 public.manage_tracking_request(uuid,uuid,jsonb),public.incoming_tracking_requests(uuid),public.accept_tracking_request(uuid,uuid,bigint,jsonb)
 from public,anon,authenticated;
grant execute on function public.manage_tracking_request(uuid,uuid,jsonb),public.incoming_tracking_requests(uuid),public.accept_tracking_request(uuid,uuid,bigint,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
