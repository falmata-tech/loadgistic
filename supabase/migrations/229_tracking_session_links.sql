-- FEAT-TRK/ENT/SEC-001. Per-session link AND separate code; no guest identity.
-- New rows only through guarded commands. Existing shipment/history/assignment
-- and proof-backed completion remain authoritative; no hosted execution here.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(8030229);
alter table public.provider_shipments alter column shipper_email drop not null,
 alter column receiver_email drop not null;

-- Reuse exact current actor/route/assignment/lifecycle guards. Internal copies
-- differ only in genuine absence of email, recipient/grant/outbox creation.
do $copies229$
declare definition text;old_text text;new_text text;
begin
 if (select md5(prosrc)from pg_proc where oid='public.create_provider_tracking_pre_route_map(uuid,jsonb)'::regprocedure)<>'d62dd66e7f603cf4520f04b607db9df6'
 or(select md5(prosrc)from pg_proc where oid='public.create_provider_tracking(uuid,jsonb)'::regprocedure)<>'4111af8a7d428bc2ec456a16a02667a3'
 or(select md5(prosrc)from pg_proc where oid='public.create_provider_tracking_with_recipients(uuid,jsonb)'::regprocedure)<>'512ef885d6161239b21cad970a1e7bad'
 or(select md5(prosrc)from pg_proc where oid='public.complete_provider_handover(uuid,uuid,text,uuid)'::regprocedure)<>'4b4de85a42f5f95a7382cebea18ab69f'
 then raise exception 'TRACKING229_INSTALLED_SOURCE_DRIFT';end if;
 definition:=pg_get_functiondef('public.create_provider_tracking_pre_route_map(uuid,jsonb)'::regprocedure);
 for old_text,new_text in values
 ($patch229$FUNCTION public.create_provider_tracking_pre_route_map($patch229$,$patch229$FUNCTION public.create_tracking_session_base_no_email($patch229$),
 ($patch229$customer_email text:=lower(trim(coalesce(command->>'customer_email','')));$patch229$,$patch229$customer_email text:=null;$patch229$),
 ($patch229$  tracking_digest text:=trim(coalesce(command->>'tracking_code_hash',''));
$patch229$,$patch229$  tracking_digest text:=encode(extensions.digest(gen_random_uuid()::text||gen_random_uuid()::text,'sha256'),'hex');
$patch229$),
 ($patch229$review_digest text:=trim(coalesce(command->>'review_code_hash',''));$patch229$,$patch229$review_digest text:=null;$patch229$),
 ($patch229$  if length(tracking_digest)<32 or length(review_digest)<32 then raise exception 'INVALID_TRACKING_INPUT'; end if;
$patch229$,$patch229$$patch229$),
 ($patch229$  if customer_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(customer_email)>254 then
    raise exception 'INVALID_EMAIL';
  end if;
$patch229$,$patch229$$patch229$),
 ($patch229$  insert into public.shipment_party_grants(id,shipment_id,party_role,code_hash,expires_at,revoked_at,created_at)
  values(gen_random_uuid(),shipment_id,'SHIPPER',tracking_digest,null,null,timestamp_value);
  insert into public.email_deliveries(
    id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status,
    attempts,last_error,next_attempt_at,sent_at,created_at,updated_at
  ) values (
    gen_random_uuid(),shipment_id,'SHIPPER','TRACKING_ACCESS',customer_email,
    'tracking-access:'||shipment_id::text,'PENDING',0,null,timestamp_value,null,timestamp_value,timestamp_value
  );
$patch229$,$patch229$  insert into public.shipment_party_grants(id,shipment_id,party_role,code_hash,expires_at,revoked_at,created_at)
  values(gen_random_uuid(),shipment_id,'SHIPPER',tracking_digest,null,null,timestamp_value);
$patch229$) loop
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'TRACKING229_COPY_ANCHOR_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
 definition:=pg_get_functiondef('public.create_provider_tracking_pre_route_map(uuid,jsonb)'::regprocedure);
 for old_text,new_text in values
 ($patch229$FUNCTION public.create_provider_tracking_pre_route_map($patch229$,$patch229$FUNCTION public.create_tracking_registered_base_no_email($patch229$),
 ($patch229$  insert into public.email_deliveries(
    id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status,
    attempts,last_error,next_attempt_at,sent_at,created_at,updated_at
  ) values (
    gen_random_uuid(),shipment_id,'SHIPPER','TRACKING_ACCESS',customer_email,
    'tracking-access:'||shipment_id::text,'PENDING',0,null,timestamp_value,null,timestamp_value,timestamp_value
  );
$patch229$,$patch229$$patch229$) loop
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'TRACKING229_COPY_ANCHOR_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
 definition:=pg_get_functiondef('public.create_provider_tracking(uuid,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,$patch229$FUNCTION public.create_provider_tracking($patch229$,'')))/length($patch229$FUNCTION public.create_provider_tracking($patch229$)<>1 then raise exception 'TRACKING229_ROUTE_ANCHOR_DRIFT';end if;
 definition:=replace(definition,$patch229$FUNCTION public.create_provider_tracking($patch229$,$patch229$FUNCTION public.create_tracking_session_shipment($patch229$);
 if (length(definition)-length(replace(definition,$patch229$public.create_provider_tracking_pre_route_map(actor_user_id,command)$patch229$,'')))/length($patch229$public.create_provider_tracking_pre_route_map(actor_user_id,command)$patch229$)<>1 then raise exception 'TRACKING229_ROUTE_ANCHOR_DRIFT';end if;
 definition:=replace(definition,$patch229$public.create_provider_tracking_pre_route_map(actor_user_id,command)$patch229$,$patch229$public.create_tracking_session_base_no_email(actor_user_id,command)$patch229$);
 execute definition;
 definition:=pg_get_functiondef('public.create_provider_tracking(uuid,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,$patch229$FUNCTION public.create_provider_tracking($patch229$,'')))/length($patch229$FUNCTION public.create_provider_tracking($patch229$)<>1 then raise exception 'TRACKING229_ROUTE_ANCHOR_DRIFT';end if;
 definition:=replace(definition,$patch229$FUNCTION public.create_provider_tracking($patch229$,$patch229$FUNCTION public.create_tracking_registered_shipment($patch229$);
 if (length(definition)-length(replace(definition,$patch229$public.create_provider_tracking_pre_route_map(actor_user_id,command)$patch229$,'')))/length($patch229$public.create_provider_tracking_pre_route_map(actor_user_id,command)$patch229$)<>1 then raise exception 'TRACKING229_ROUTE_ANCHOR_DRIFT';end if;
 definition:=replace(definition,$patch229$public.create_provider_tracking_pre_route_map(actor_user_id,command)$patch229$,$patch229$public.create_tracking_registered_base_no_email(actor_user_id,command)$patch229$);
 execute definition;
 definition:=pg_get_functiondef('public.complete_provider_handover(uuid,uuid,text,uuid)'::regprocedure);
 old_text:=$completion229$ insert into public.email_deliveries(id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status,attempts,next_attempt_at,created_at,updated_at)
 values(gen_random_uuid(),shipment.id,'SHIPPER','COMPLETION',shipment.shipper_email,'completion:'||shipment.id::text||':OWNER','PENDING',0,stamp,stamp,stamp)
 on conflict(idempotency_key) do nothing;$completion229$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'TRACKING229_COMPLETION_ANCHOR_DRIFT';end if;
 execute replace(definition,old_text,' if shipment.shipper_email is not null then'||E'\n'||old_text||E'\n end if;');
 definition:=pg_get_functiondef('public.tracking_owner_sharing_command(uuid,text,timestamptz,jsonb,uuid)'::regprocedure);
 old_text:=' owner_id:=public.tracking_fresh_owner_recipient(target_shipment_id,recipient_digest,verified_at);';
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'TRACKING229_SHARING_ANCHOR_DRIFT';end if;
 execute replace(definition,old_text,' if action_value=''ADD_VIEWER'' then raise exception ''TRACKING_EMAIL_SHARING_RETIRED'';end if;'||E'\n'||old_text);
end $copies229$;

create table public.tracking_sessions(
 id uuid primary key default gen_random_uuid(),
 reference text not null unique default('LGT-'||upper(left(replace(gen_random_uuid()::text,'-',''),8))),
 state text not null default 'PENDING_PROVIDER' check(state in('PENDING_PROVIDER','CONNECTED','CANCELLED')),
 revision integer not null default 0 check(revision>=0),
 workspace_id uuid references public.business_workspaces(id) on delete cascade,
 owner_user_id uuid references public.profiles(id) on delete set null,
 created_by uuid references public.profiles(id) on delete set null,
 origin_kind text not null check(origin_kind in('BROKER_REQUEST','AUTHORIZED_SHIPMENT')),
 shipment_id uuid unique references public.provider_shipments(id) on delete cascade,
 route jsonb not null check(jsonb_typeof(route)='array' and jsonb_array_length(route)between 2 and 3),
 cargo_summary text not null check(length(trim(cargo_summary))between 3 and 500),
 pickup_date date,delivery_date date not null,
 provider_location_consent boolean not null default false,
 provider_connected_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 pending_expires_at timestamptz not null default(clock_timestamp()+interval '30 days'),
 check(pickup_date is null or delivery_date>=pickup_date),
 check(state<>'CONNECTED' or shipment_id is not null),
 check(state<>'PENDING_PROVIDER' or shipment_id is null and workspace_id is not null)
);
create index tracking_sessions_workspace on public.tracking_sessions(workspace_id,created_at desc,id);
create index tracking_sessions_owner on public.tracking_sessions(owner_user_id,created_at desc,id);
create table public.tracking_session_links(
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.tracking_sessions(id) on delete cascade,
 link_digest text not null unique check(link_digest~'^[a-f0-9]{64}$'),
 code_digest text not null check(code_digest~'^[a-f0-9]{64}$' and code_digest<>link_digest),
 allow_location boolean not null,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 check(expires_at>created_at and expires_at<=created_at+interval '30 days')
);
create index tracking_session_links_scope on public.tracking_session_links(session_id,expires_at);
alter table public.tracking_sessions enable row level security;
alter table public.tracking_session_links enable row level security;
revoke all on public.tracking_sessions,public.tracking_session_links from public,anon,authenticated,service_role;

create function public.tracking229_source_active(s public.tracking_sessions) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select case when s.state='CANCELLED' then false
 when s.state='PENDING_PROVIDER' then s.pending_expires_at>clock_timestamp() and exists(select 1 from public.business_workspaces w where w.id=s.workspace_id and w.active)
 else exists(select 1 from public.provider_shipments p where p.id=s.shipment_id and p.operational_status<>'CANCELLED'
  and(p.guest_expires_at is null or p.guest_expires_at>clock_timestamp()))
  and(s.workspace_id is null or exists(select 1 from public.business_workspaces w where w.id=s.workspace_id and w.active))
  and(s.origin_kind='BROKER_REQUEST' or exists(select 1 from public.shipment_party_grants g where g.shipment_id=s.shipment_id and g.party_role='SHIPPER' and g.revoked_at is null and(g.expires_at is null or g.expires_at>clock_timestamp()))) end
$$;
create function public.tracking229_owner_active(actor_user_id uuid,s public.tracking_sessions) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select s.origin_kind='AUTHORIZED_SHIPMENT' and s.owner_user_id=actor_user_id and public.business_customer_identity(actor_user_id,false)
 and exists(select 1 from public.provider_tracking_recipients r where r.shipment_id=s.shipment_id and r.recipient_role='OWNER' and r.revoked_at is null)
$$;
-- Retained business pages/API use this envelope for owner-only proof/actions.
-- Keep historical share activation and explicit staff location grants intact;
-- a recycled address never establishes the captured actual account owner.
do $businessowner229$
declare definition text;old_text text:=' is_owner:=public.tracking_owner_is_member_identity(actor_user_id,owner_id);';
 new_text text:=$owner229$ is_owner:=exists(select 1 from public.tracking_sessions s join public.provider_tracking_recipients r on r.shipment_id=s.shipment_id
  where s.shipment_id=target_shipment_id and r.id=owner_id and r.recipient_role='OWNER'and r.revoked_at is null
  and public.tracking229_owner_active(actor_user_id,s));$owner229$;
begin
 if(select md5(prosrc)from pg_proc where oid='public.business_tracking_detail(uuid,uuid,uuid)'::regprocedure)<>'fbe7bcb14a645b85809b1885fd106ca3'then raise exception 'TRACKING229_BUSINESS_OWNER_SOURCE_DRIFT';end if;
 definition:=pg_get_functiondef('public.business_tracking_detail(uuid,uuid,uuid)'::regprocedure);
 if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'TRACKING229_BUSINESS_OWNER_ANCHOR_DRIFT';end if;
 execute replace(definition,old_text,new_text);
end $businessowner229$;
create function public.tracking229_can_read(actor_user_id uuid,s public.tracking_sessions) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select coalesce(public.provider_tracking_actor_owns_shipment(actor_user_id,s.shipment_id),false)
 or coalesce(public.tracking229_owner_active(actor_user_id,s),false)
 or(s.workspace_id is not null and public.business_workspace_permission(actor_user_id,s.workspace_id,'TRACKING')
  and(s.origin_kind='BROKER_REQUEST' or public.tracking_business_share_active(s.shipment_id,s.workspace_id)))
$$;
create function public.tracking229_can_manage(actor_user_id uuid,s public.tracking_sessions) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select coalesce(public.provider_tracking_actor_owns_shipment(actor_user_id,s.shipment_id),false)
 or coalesce(public.tracking229_owner_active(actor_user_id,s),false)
 or(s.workspace_id is not null and public.business_workspace_permission(actor_user_id,s.workspace_id,'TRACKING')
  and public.business_workspace_permission(actor_user_id,s.workspace_id,'TEAM')
  and(s.origin_kind='BROKER_REQUEST' or public.tracking_business_share_active(s.shipment_id,s.workspace_id)))
$$;
create function public.tracking229_can_locate(actor_user_id uuid,s public.tracking_sessions) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select coalesce(public.provider_tracking_actor_owns_shipment(actor_user_id,s.shipment_id),false)
 or coalesce(public.tracking229_owner_active(actor_user_id,s),false)
 or(s.workspace_id is not null and public.business_workspace_permission(actor_user_id,s.workspace_id,'TRACKING') and(
  s.origin_kind='BROKER_REQUEST' and public.business_workspace_permission(actor_user_id,s.workspace_id,'OWNER')
  or s.origin_kind='AUTHORIZED_SHIPMENT' and public.tracking_business_share_active(s.shipment_id,s.workspace_id)
   and exists(select 1 from public.tracking_staff_location_grants l join public.business_workspace_members m on m.workspace_id=l.workspace_id and m.user_id=l.user_id
    where l.shipment_id=s.shipment_id and l.workspace_id=s.workspace_id and l.user_id=actor_user_id and l.revoked_at is null and m.active and m.revision=l.member_revision)))
$$;
create function public.tracking229_can_approve(actor_user_id uuid,s public.tracking_sessions) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select public.tracking229_source_active(s) and exists(select 1 from public.provider_shipments p where p.id=s.shipment_id and p.operational_status='UNLOADING') and(
 coalesce(public.tracking229_owner_active(actor_user_id,s),false)
 or s.origin_kind='BROKER_REQUEST' and public.business_workspace_permission(actor_user_id,s.workspace_id,'TRACKING') and public.business_workspace_permission(actor_user_id,s.workspace_id,'OWNER'))
$$;
-- Mutations lock current identity/membership and session before their final
-- authority check. They never convert an invited guest into a member or owner.
create function public.tracking229_actual_owner(actor_user_id uuid,s public.tracking_sessions) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select coalesce(public.tracking229_owner_active(actor_user_id,s),false)
 or(s.origin_kind='BROKER_REQUEST' and public.business_workspace_permission(actor_user_id,s.workspace_id,'TRACKING')and public.business_workspace_permission(actor_user_id,s.workspace_id,'OWNER'))
$$;
create function public.tracking229_can_read_proof(actor_user_id uuid,s public.tracking_sessions) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select coalesce(public.provider_tracking_actor_owns_shipment(actor_user_id,s.shipment_id),false)or(public.tracking229_source_active(s)and public.tracking229_actual_owner(actor_user_id,s))
$$;
create function public.tracking229_can_review(actor_user_id uuid,s public.tracking_sessions) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select public.tracking229_source_active(s)and public.tracking229_actual_owner(actor_user_id,s)
 and public.provider_tracking_actor_owns_shipment(actor_user_id,s.shipment_id)is distinct from true
 and exists(select 1 from public.provider_shipments p where p.id=s.shipment_id and p.operational_status='COMPLETED'and p.guest_expires_at>clock_timestamp())
 and not exists(select 1 from public.provider_reviews r where r.shipment_id=s.shipment_id)
$$;
create function public.tracking229_lock_actor(actor_user_id uuid,s public.tracking_sessions) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 perform 1 from public.profiles p where p.id=actor_user_id for share;
 perform 1 from auth.users u where u.id=actor_user_id for share;
 if s.workspace_id is not null then
  perform 1 from public.business_workspaces w where w.id=s.workspace_id for share;
  perform 1 from public.business_workspace_members m where m.workspace_id=s.workspace_id and m.user_id=actor_user_id for share;
 end if;
 if s.shipment_id is not null then
  perform 1 from public.provider_shipments p where p.id=s.shipment_id for share;
  perform 1 from public.organization_members m join public.provider_shipments p on p.provider_organization_id=m.organization_id
   where p.id=s.shipment_id and m.user_id=actor_user_id for share of m;
  perform 1 from public.driver_vehicle_assignments a join public.provider_shipments p on p.assigned_vehicle_id=a.vehicle_id
   where p.id=s.shipment_id and a.driver_user_id=actor_user_id and a.active for share of a;
 end if;
end $$;
create function public.tracking229_shipment_projection(s public.tracking_sessions,allow_location boolean) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare p public.provider_shipments%rowtype;point jsonb;
begin
 if s.shipment_id is null then return null;end if;
 select * into p from public.provider_shipments where id=s.shipment_id;
 if not found then return null;end if;
 if allow_location and s.provider_location_consent then point:=public.tracking_selected_location(p.id);end if;
 if coalesce(point->>'location_source','') not in('TELEMATICS','DEVICE_OBSCURED') then point:=null;end if;
 return jsonb_build_object('id',p.id,'code',p.code,'origin',p.origin,'destination',p.destination,'cargo_summary',p.cargo_summary,
  'operational_status',p.operational_status,'updated_at',p.updated_at,'tracking_mode',p.tracking_mode,'expected_pickup_date',p.expected_pickup_date,'expected_delivery_date',p.expected_delivery_date,
  'route',public.tracking_route_projection(p.id),'provider_name',public.provider_public_account_name(p.provider_organization_id,p.provider_profile_id),
  'current_location',point,'can_view_location',allow_location and s.provider_location_consent,'can_share',false,'can_approve',false,'can_review',false,
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'note',coalesce(e.note,''),'created_at',e.created_at,'has_proof',false)order by e.created_at,e.id)
   from public.provider_shipment_events e where e.shipment_id=p.id and e.event_type='STATUS'),'[]'::jsonb));
end $$;
create function public.tracking_session_detail(actor_user_id uuid,target_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare s public.tracking_sessions%rowtype;active boolean;manage boolean;provider_actor boolean;proof boolean;shipment jsonb;
begin
 select * into s from public.tracking_sessions where id=target_session_id;
 if not found or public.tracking229_can_read(actor_user_id,s) is distinct from true then raise exception 'NOT_FOUND';end if;
 active:=public.tracking229_source_active(s);manage:=active and public.tracking229_can_manage(actor_user_id,s);
 select exists(select 1 from public.provider_tracking_actor_scope(actor_user_id) a where a.can_manage_tracking and a.workspace_access) into provider_actor;
 proof:=public.tracking229_can_read_proof(actor_user_id,s);
 shipment:=public.tracking229_shipment_projection(s,active and public.tracking229_can_locate(actor_user_id,s));
 if shipment is not null and public.tracking229_actual_owner(actor_user_id,s)then
  shipment:=jsonb_set(shipment,'{review}',coalesce((select jsonb_build_object('rating',r.rating,'note',r.note,'createdAt',r.created_at)from public.provider_reviews r where r.shipment_id=s.shipment_id),'null'::jsonb));
 end if;
 if shipment is not null and proof then
  shipment:=jsonb_set(shipment,'{events}',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'note',coalesce(e.note,''),'created_at',e.created_at,
   'has_proof',coalesce(e.proof_storage_path like 'supabase://shipment-proof/%'and e.proof_mime_type in('image/jpeg','image/png','image/webp'),false))order by e.created_at,e.id)
   from public.provider_shipment_events e where e.shipment_id=s.shipment_id and e.event_type='STATUS'),'[]'::jsonb));
 end if;
 return jsonb_build_object('id',s.id,'reference',s.reference,'state',s.state,'revision',s.revision,'workspaceId',s.workspace_id,'shipmentId',s.shipment_id,
  'route',s.route,'cargoSummary',s.cargo_summary,'pickupDate',s.pickup_date,'deliveryDate',s.delivery_date,
  'capabilities',jsonb_build_object('canIssueLink',manage,'canRevokeLink',manage,'canAcceptProvider',active and s.state='PENDING_PROVIDER' and provider_actor,'canApprove',public.tracking229_can_approve(actor_user_id,s),'canReadProof',proof,'canReview',public.tracking229_can_review(actor_user_id,s),'canManageTeam',coalesce(public.tracking229_owner_active(actor_user_id,s),false)),
  'links',case when manage then coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'createdAt',l.created_at,'expiresAt',l.expires_at,'revokedAt',l.revoked_at,'allowLocation',l.allow_location)order by l.created_at,l.id)
   from public.tracking_session_links l where l.session_id=s.id),'[]'::jsonb) else '[]'::jsonb end,
  'shipment',shipment);
end $$;
create function public.create_tracking_session(actor_user_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare workspace uuid;requested_route jsonb;point record;route jsonb:='[]';seen text[]:='{}';entry jsonb;pickup date;delivery date;s public.tracking_sessions%rowtype;
begin
 if command is null or jsonb_typeof(command)<>'object' or exists(select 1 from jsonb_object_keys(command) k where k not in('workspaceId','route','cargoDescription','pickupDate','deliveryDate')) then raise exception 'INVALID_TRACKING_INPUT';end if;
 workspace:=(command->>'workspaceId')::uuid;
 perform 1 from public.business_workspaces w where w.id=workspace for share;
 perform 1 from public.business_workspace_members m where m.workspace_id=workspace and m.user_id=actor_user_id for share;
 perform 1 from public.profiles p where p.id=actor_user_id for share;
 perform 1 from auth.users u where u.id=actor_user_id for share;
 if public.business_workspace_permission(actor_user_id,workspace,'TRACKING') is distinct from true or public.business_workspace_permission(actor_user_id,workspace,'TEAM') is distinct from true then raise exception 'BUSINESS_FORBIDDEN';end if;
 perform public.require_content_policy(actor_user_id);
 requested_route:=command->'route';
 if jsonb_typeof(requested_route) is distinct from 'array' or jsonb_array_length(requested_route)<>3 then raise exception 'LOCALITY_REQUIRED';end if;
 for entry in select value from jsonb_array_elements(requested_route) loop
  if jsonb_typeof(entry) is distinct from 'object' or entry->>'placeRef' is null or exists(select 1 from jsonb_object_keys(entry) k where k<>'placeRef') then raise exception 'LOCALITY_REQUIRED';end if;
  select c.* into point from public.place_catalog c where c.id=entry->>'placeRef';
  if not found or point.latitude is null or point.longitude is null then raise exception 'LOCALITY_REQUIRED';end if;
  if point.id=any(seen) then raise exception 'ROUTE_LOCATIONS_MUST_DIFFER';end if;
  seen:=array_append(seen,point.id);
  route:=route||jsonb_build_array(jsonb_build_object('placeRef',point.id,'label',concat_ws(', ',point.name,case when point.parent_name is not null and lower(point.parent_name)<>lower(point.name)then point.parent_name end,coalesce(point.country_name,'Ethiopia')),'coordinate',jsonb_build_array(point.longitude,point.latitude)));
 end loop;
 if command->>'cargoDescription' is null or length(trim(command->>'cargoDescription'))not between 3 and 500 then raise exception 'INVALID_CARGO_SUMMARY';end if;
 pickup:=nullif(command->>'pickupDate','')::date;delivery:=nullif(command->>'deliveryDate','')::date;
 if delivery is null or pickup is not null and delivery<pickup then raise exception 'INVALID_DELIVERY_DATE';end if;
 insert into public.tracking_sessions(workspace_id,created_by,origin_kind,route,cargo_summary,pickup_date,delivery_date)
 values(workspace,actor_user_id,'BROKER_REQUEST',route,trim(command->>'cargoDescription'),pickup,delivery) returning * into s;
 insert into public.business_workspace_audit(workspace_id,actor_user_id,action,subject_id) values(workspace,actor_user_id,'TRACKING_SESSION_CREATED',s.id);
 return public.tracking_session_detail(actor_user_id,s.id);
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception 'INVALID_TRACKING_INPUT';
end $$;
create function public.link_tracking_shipment(actor_user_id uuid,target_shipment_id uuid,target_workspace_id uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare s public.tracking_sessions%rowtype;p public.provider_shipments%rowtype;owner_id uuid;provider_actor boolean;business_actor boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('tracking-session-bind:'||target_shipment_id::text,0));
 select *into s from public.tracking_sessions where shipment_id=target_shipment_id for update;
 if found then
  perform public.tracking229_lock_actor(actor_user_id,s);
  if public.tracking229_can_manage(actor_user_id,s)is distinct from true then raise exception 'NOT_FOUND';end if;
  if target_workspace_id is not null then
   perform 1 from public.business_workspaces w where w.id=target_workspace_id for share;
   perform 1 from public.business_workspace_members m where m.workspace_id=target_workspace_id and m.user_id=actor_user_id for share;
   if public.business_workspace_permission(actor_user_id,target_workspace_id,'TRACKING')is distinct from true
    or public.business_workspace_permission(actor_user_id,target_workspace_id,'TEAM')is distinct from true
    or public.tracking_business_share_active(target_shipment_id,target_workspace_id)is distinct from true then raise exception 'BUSINESS_FORBIDDEN';end if;
   if s.workspace_id is null then update public.tracking_sessions set workspace_id=target_workspace_id,revision=revision+1,updated_at=clock_timestamp()where id=s.id;
   elsif s.workspace_id<>target_workspace_id then raise exception 'TRACKING_SHARING_CHANGED';end if;
  end if;
  return public.tracking_session_detail(actor_user_id,s.id);
 end if;
 select *into p from public.provider_shipments where id=target_shipment_id for share;
 if not found then raise exception 'NOT_FOUND';end if;
 provider_actor:=public.provider_tracking_actor_owns_shipment(actor_user_id,p.id);
 select c.owner_actor_id into owner_id from public.tracking_sharing_controls c
 join public.provider_tracking_recipients r on r.id=c.owner_recipient_id and r.shipment_id=c.shipment_id
 join auth.users u on u.id=c.owner_actor_id join public.profiles owner_profile on owner_profile.id=u.id
 where c.shipment_id=p.id and r.recipient_role='OWNER'and r.revoked_at is null
 and public.business_customer_identity(c.owner_actor_id,false)and public.tracking_business_share_active(p.id,c.business_workspace_id)
 for share of c,r,u,owner_profile;
 if target_workspace_id is not null then
  perform 1 from public.business_workspaces w where w.id=target_workspace_id for share;
  perform 1 from public.business_workspace_members m where m.workspace_id=target_workspace_id and m.user_id=actor_user_id for share;
  business_actor:=public.business_workspace_permission(actor_user_id,target_workspace_id,'TRACKING')and public.business_workspace_permission(actor_user_id,target_workspace_id,'TEAM')and public.tracking_business_share_active(p.id,target_workspace_id);
 else business_actor:=false;end if;
 if provider_actor is distinct from true and business_actor is distinct from true and owner_id is distinct from actor_user_id then raise exception 'NOT_FOUND';end if;
 if target_workspace_id is not null and business_actor is distinct from true then raise exception 'BUSINESS_FORBIDDEN';end if;
 insert into public.tracking_sessions(reference,state,workspace_id,owner_user_id,created_by,origin_kind,shipment_id,route,cargo_summary,pickup_date,delivery_date,provider_location_consent)
 values(p.code,'CONNECTED',target_workspace_id,owner_id,actor_user_id,'AUTHORIZED_SHIPMENT',p.id,public.tracking_route_projection(p.id),p.cargo_summary,p.expected_pickup_date,p.expected_delivery_date,p.tracking_mode='LOCATION_AND_STATUS')returning *into s;
 return public.tracking_session_detail(actor_user_id,s.id);
end $$;
create function public.issue_tracking_session_link(actor_user_id uuid,target_session_id uuid,link_digest text,code_digest text,command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare s public.tracking_sessions%rowtype;l public.tracking_session_links%rowtype;days integer;location boolean;stamp timestamptz:=clock_timestamp();expiry timestamptz;
begin
 select * into s from public.tracking_sessions where id=target_session_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 perform public.tracking229_lock_actor(actor_user_id,s);
 if public.tracking229_can_manage(actor_user_id,s) is distinct from true then raise exception 'FORBIDDEN';end if;
 if public.tracking229_source_active(s) is distinct from true then raise exception 'TRACKING_ACCESS_DENIED';end if;
 if link_digest is null or code_digest is null or link_digest!~'^[a-f0-9]{64}$' or code_digest!~'^[a-f0-9]{64}$' or link_digest=code_digest
 or command is null or jsonb_typeof(command)<>'object' or exists(select 1 from jsonb_object_keys(command) k where k not in('expiresInDays','allowLocation'))
 or jsonb_typeof(command->'allowLocation') is distinct from 'boolean'
 or command?'expiresInDays' and(jsonb_typeof(command->'expiresInDays') is distinct from 'number' or command->>'expiresInDays'!~'^[0-9]+$') then raise exception 'INVALID_TRACKING_INPUT';end if;
 days:=coalesce((command->>'expiresInDays')::integer,7);location:=(command->>'allowLocation')::boolean;
 if days not between 1 and 30 then raise exception 'INVALID_TRACKING_INPUT';end if;
 if location and public.tracking229_can_locate(actor_user_id,s) is distinct from true then raise exception 'FORBIDDEN';end if;
 if(select count(*)from public.tracking_session_links x where x.session_id=s.id and x.revoked_at is null and x.expires_at>stamp)>=20 then raise exception 'TRACKING_RECIPIENT_LIMIT';end if;
 expiry:=stamp+make_interval(days=>days);
 if s.state='PENDING_PROVIDER' then expiry:=least(expiry,s.pending_expires_at);else
  select least(expiry,coalesce(p.guest_expires_at,expiry)) into expiry from public.provider_shipments p where p.id=s.shipment_id;
 end if;
 if expiry<=stamp then raise exception 'TRACKING_ACCESS_DENIED';end if;
 insert into public.tracking_session_links(session_id,link_digest,code_digest,allow_location,created_by,created_at,expires_at)
 values(s.id,link_digest,code_digest,location,actor_user_id,stamp,expiry) returning *into l;
 update public.tracking_sessions set revision=revision+1,updated_at=stamp where id=s.id;
 return jsonb_build_object('id',l.id,'sessionId',l.session_id,'createdAt',l.created_at,'expiresAt',l.expires_at,'revokedAt',l.revoked_at,'allowLocation',l.allow_location);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'INVALID_TRACKING_INPUT';
end $$;
create function public.revoke_tracking_session_link(actor_user_id uuid,target_session_id uuid,target_link_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare s public.tracking_sessions%rowtype;stamp timestamptz:=clock_timestamp();
begin
 select *into s from public.tracking_sessions where id=target_session_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 perform public.tracking229_lock_actor(actor_user_id,s);
 if public.tracking229_can_manage(actor_user_id,s) is distinct from true then raise exception 'FORBIDDEN';end if;
 perform 1 from public.tracking_session_links l where l.id=target_link_id and l.session_id=s.id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 update public.tracking_session_links set revoked_at=coalesce(revoked_at,stamp) where id=target_link_id;
 update public.tracking_sessions set revision=revision+1,updated_at=stamp where id=s.id;
 return public.tracking_session_detail(actor_user_id,s.id);
end $$;
create function public.read_tracking_session_link(link_digest text,code_digest text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare l public.tracking_session_links%rowtype;s public.tracking_sessions%rowtype;expiry timestamptz;
begin
 if link_digest is null or code_digest is null or link_digest!~'^[a-f0-9]{64}$' or code_digest!~'^[a-f0-9]{64}$' then return null;end if;
 select *into l from public.tracking_session_links x where x.link_digest=read_tracking_session_link.link_digest and x.code_digest=read_tracking_session_link.code_digest and x.revoked_at is null and x.expires_at>clock_timestamp();
 if not found then return null;end if;
 select *into s from public.tracking_sessions where id=l.session_id;
 if not found or public.tracking229_source_active(s) is distinct from true then return null;end if;
 if s.origin_kind='AUTHORIZED_SHIPMENT' and s.workspace_id is not null and public.tracking_business_share_active(s.shipment_id,s.workspace_id) is distinct from true then return null;end if;
 expiry:=l.expires_at;
 if s.state='PENDING_PROVIDER' then expiry:=least(expiry,s.pending_expires_at);else
  select least(expiry,coalesce(p.guest_expires_at,expiry)) into expiry from public.provider_shipments p where p.id=s.shipment_id;
 end if;
 return jsonb_build_object('id',s.id,'sessionId',s.id,'state',s.state,'expiresAt',expiry,'shipmentId',s.shipment_id,'reference',s.reference,'route',s.route,
 'cargoSummary',s.cargo_summary,'pickupDate',s.pickup_date,'deliveryDate',s.delivery_date,'shipment',public.tracking229_shipment_projection(s,l.allow_location));
end $$;
create function public.connect_tracking_session(actor_user_id uuid,target_session_id uuid,link_digest text,code_digest text,command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare s public.tracking_sessions%rowtype;l public.tracking_session_links%rowtype;created jsonb;mode text;new_id uuid:=gen_random_uuid();native_command jsonb;workspace_review boolean;actual_owner uuid;
begin
 select *into s from public.tracking_sessions where id=target_session_id for update;
 if not found then raise exception 'TRACKING_ACCESS_DENIED';end if;
 select *into l from public.tracking_session_links x where x.session_id=s.id and x.link_digest=connect_tracking_session.link_digest and x.code_digest=connect_tracking_session.code_digest and x.revoked_at is null and x.expires_at>clock_timestamp() for share;
 if not found or public.tracking229_source_active(s) is distinct from true then raise exception 'TRACKING_ACCESS_DENIED';end if;
 if s.state<>'PENDING_PROVIDER' then raise exception 'TRACKING_SESSION_ALREADY_CONNECTED';end if;
 if command is null or jsonb_typeof(command)<>'object' or exists(select 1 from jsonb_object_keys(command) k where k not in('vehicleId','trackingMode')) then raise exception 'INVALID_TRACKING_INPUT';end if;
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
  'vehicle_id',command->>'vehicleId','origin_place_ref',s.route->0->>'placeRef','passing_place_ref',s.route->1->>'placeRef','destination_place_ref',s.route->2->>'placeRef',
  'cargo_summary',s.cargo_summary,'expected_pickup_date',s.pickup_date,'expected_delivery_date',s.delivery_date,'tracking_mode',mode);
 perform pg_advisory_xact_lock(hashtextextended('tracking-session-bind:'||new_id::text,0));
 created:=public.create_tracking_session_shipment(actor_user_id,native_command);
 select w.review_workspace into workspace_review from public.business_workspaces w where w.id=s.workspace_id;
 if public.business_shipment_review_scope(new_id) is distinct from workspace_review then raise exception 'REVIEW_WORKSPACE_ONLY';end if;
 update public.tracking_sessions set state='CONNECTED',shipment_id=new_id,owner_user_id=actual_owner,provider_connected_by=actor_user_id,provider_location_consent=mode='LOCATION_AND_STATUS',revision=revision+1,updated_at=clock_timestamp() where id=s.id;
 return public.tracking_session_detail(actor_user_id,s.id);
exception when invalid_text_representation then raise exception 'INVALID_TRACKING_INPUT';
end $$;
create function public.tracking_session_workspace(actor_user_id uuid,target_workspace_id uuid,requested_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare total integer;page integer;sessions jsonb;
begin
 if target_workspace_id is not null then
  if public.business_workspace_permission(actor_user_id,target_workspace_id,'TRACKING') is distinct from true then raise exception 'BUSINESS_FORBIDDEN';end if;
 elsif public.business_customer_identity(actor_user_id,false) is distinct from true then raise exception 'BUSINESS_FORBIDDEN';end if;
 select count(*)into total from public.tracking_sessions s where(s.workspace_id=target_workspace_id or target_workspace_id is null and s.owner_user_id=actor_user_id and s.origin_kind='AUTHORIZED_SHIPMENT')and public.tracking229_can_read(actor_user_id,s);
 page:=greatest(1,least(coalesce(requested_page,1),greatest(1,ceil(total/20.0)::integer)));
 select coalesce(jsonb_agg(public.tracking_session_detail(actor_user_id,s.id)order by s.created_at desc,s.id),'[]'::jsonb)into sessions from(
  select x.*from public.tracking_sessions x where(x.workspace_id=target_workspace_id or target_workspace_id is null and x.owner_user_id=actor_user_id and x.origin_kind='AUTHORIZED_SHIPMENT')and public.tracking229_can_read(actor_user_id,x)
  order by x.created_at desc,x.id limit 20 offset(page-1)*20)s;
 return jsonb_build_object('workspaceId',target_workspace_id,'total',total,'page',page,'pageCount',greatest(1,ceil(total/20.0)::integer),'sessions',sessions);
end $$;
create function public.approve_tracking_session_handover(actor_user_id uuid,target_session_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare s public.tracking_sessions%rowtype;recipient uuid;
begin
 select *into s from public.tracking_sessions where id=target_session_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 perform public.tracking229_lock_actor(actor_user_id,s);
 if public.tracking229_source_active(s)and public.tracking229_actual_owner(actor_user_id,s)and exists(select 1 from public.provider_shipments p where p.id=s.shipment_id and p.operational_status='COMPLETED'and p.handover_approved_at is not null)then return public.tracking_session_detail(actor_user_id,s.id);end if;
 if public.tracking229_can_approve(actor_user_id,s) is distinct from true then raise exception 'TRACKING_APPROVAL_FORBIDDEN';end if;
 if s.origin_kind='AUTHORIZED_SHIPMENT' then select id into recipient from public.provider_tracking_recipients r where r.shipment_id=s.shipment_id and r.recipient_role='OWNER' and r.revoked_at is null for share;end if;
 perform public.complete_provider_handover(s.shipment_id,actor_user_id,'OWNER',recipient);
 update public.tracking_sessions set revision=revision+1,updated_at=clock_timestamp()where id=s.id;
 return public.tracking_session_detail(actor_user_id,s.id);
end $$;

create function public.tracking_session_proof_file(actor_user_id uuid,target_session_id uuid,target_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare s public.tracking_sessions%rowtype;result jsonb;
begin
 select *into s from public.tracking_sessions where id=target_session_id;
 if not found or public.tracking229_can_read_proof(actor_user_id,s)is distinct from true then return null;end if;
 select jsonb_build_object('storage_path',e.proof_storage_path,'original_name',e.proof_original_name,'mime_type',e.proof_mime_type)into result
 from public.provider_shipment_events e where e.id=target_event_id and e.shipment_id=s.shipment_id
 and e.proof_storage_path like 'supabase://shipment-proof/%'and e.proof_mime_type in('image/jpeg','image/png','image/webp');
 return result;
end $$;
create function public.review_tracking_session_provider(actor_user_id uuid,target_session_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare s public.tracking_sessions%rowtype;review_id uuid;
begin
 select *into s from public.tracking_sessions where id=target_session_id for update;
 if not found then raise exception 'REVIEW_NOT_ALLOWED';end if;
 perform public.tracking229_lock_actor(actor_user_id,s);
 if public.tracking229_can_review(actor_user_id,s)is distinct from true then raise exception 'REVIEW_NOT_ALLOWED';end if;
 if command is null or jsonb_typeof(command)<>'object'or exists(select 1 from jsonb_object_keys(command)k where k not in('rating','note','termsAccepted'))
 or command->'termsAccepted'is distinct from 'true'::jsonb or jsonb_typeof(command->'rating')is distinct from 'number'or command->>'rating'!~'^[1-5]$'
 or command?'note'and(jsonb_typeof(command->'note')is distinct from 'string'or length(command->>'note')>1000)then raise exception 'INVALID_RATING';end if;
 perform public.accept_content_policy(actor_user_id,'2026-10-09');
 perform public.require_content_policy(actor_user_id);
 review_id:=public.submit_provider_tracking_review(s.shipment_id,'SHIPPER',(command->>'rating')::integer,command->>'note');
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)values(actor_user_id,'ACCOUNT_TRACKING_REVIEW_SUBMITTED','provider_review',review_id,jsonb_build_object('sessionId',s.id));
 update public.tracking_sessions set revision=revision+1,updated_at=clock_timestamp()where id=s.id;
 return public.tracking_session_detail(actor_user_id,s.id);
end $$;

-- Capture the actual registered account at provider creation, before its email
-- could change; guest secrets never establish this identity or team membership.
create or replace function public.create_provider_tracking_with_recipients(actor_user_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare account_id uuid;created jsonb;owner_email text:=lower(trim(command->>'customer_email'));digest text:=command->>'customer_email_digest';p public.provider_shipments%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('tracking-session-bind:'||(command->>'id'),0));
 if not exists(select 1 from public.provider_tracking_actor_scope(actor_user_id)a where a.can_manage_tracking)then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.provider_tracking_actor_scope(actor_user_id)a where a.workspace_access)then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED';end if;
 if command?'additional_recipients' and(jsonb_typeof(command->'additional_recipients')<>'array'or jsonb_array_length(command->'additional_recipients')<>0)then raise exception 'TRACKING_OWNER_SHARES_ACCESS';end if;
 select u.id into account_id from auth.users u join public.profiles profile on profile.id=u.id
 where lower(trim(u.email))=owner_email and public.business_customer_identity(u.id,false)for share of u,profile;
 if account_id is null or digest is null or digest!~'^[a-f0-9]{64}$'then raise exception 'TRACKING_REGISTERED_OWNER_REQUIRED';end if;
 created:=public.create_tracking_registered_shipment(actor_user_id,command-'additional_recipients');
 insert into public.provider_tracking_recipients(shipment_id,recipient_role,recipient_email,recipient_email_digest,created_by)values((created->>'id')::uuid,'OWNER',owner_email,digest,actor_user_id);
 select *into p from public.provider_shipments where id=(created->>'id')::uuid;
 insert into public.tracking_sessions(reference,state,owner_user_id,created_by,origin_kind,shipment_id,route,cargo_summary,pickup_date,delivery_date,provider_location_consent)
 values(p.code,'CONNECTED',account_id,actor_user_id,'AUTHORIZED_SHIPMENT',p.id,public.tracking_route_projection(p.id),p.cargo_summary,p.expected_pickup_date,p.expected_delivery_date,p.tracking_mode='LOCATION_AND_STATUS');
 return created;
end $$;

-- No browser role can invoke actor-id or digest commands; only the server
-- adapter exposes them. Legacy email guest endpoints are retired by the app.
do $acl229$
declare signature text;
begin
 for signature in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'and(p.proname like 'tracking229_%'or p.proname in('create_tracking_session_base_no_email','create_tracking_registered_base_no_email','create_tracking_session_shipment','create_tracking_registered_shipment'))loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);
 end loop;
 foreach signature in array array[
 'public.create_tracking_session(uuid,jsonb)','public.connect_tracking_session(uuid,uuid,text,text,jsonb)','public.link_tracking_shipment(uuid,uuid,uuid)',
 'public.issue_tracking_session_link(uuid,uuid,text,text,jsonb)','public.revoke_tracking_session_link(uuid,uuid,uuid)','public.read_tracking_session_link(text,text)',
 'public.tracking_session_detail(uuid,uuid)','public.tracking_session_workspace(uuid,uuid,integer)','public.approve_tracking_session_handover(uuid,uuid)',
 'public.create_provider_tracking_with_recipients(uuid,jsonb)','public.tracking_session_proof_file(uuid,uuid,uuid)','public.review_tracking_session_provider(uuid,uuid,jsonb)']loop
  execute format('revoke all on function %s from public,anon,authenticated',signature);
  execute format('grant execute on function %s to service_role',signature);
 end loop;
 -- The old unwrapped server RPC could queue anonymous access email. Internal
 -- governed historical/demo commands may still call it as the definer owner.
 revoke execute on function public.create_provider_tracking(uuid,jsonb),public.request_tracking_email_session(uuid,text,text,text,timestamptz),
 public.consume_tracking_email_session(uuid,text,text),public.request_provider_tracking_otp(uuid,text,text,text,text,timestamptz),
 public.consume_provider_tracking_otp(uuid,text,text,text),public.unlock_provider_tracking(text),
 public.list_tracking_email_shipments(text,integer),public.unlock_provider_review(uuid,text)
 from service_role;
end $acl229$;

-- Admit only historical ownership already captured by a normal authenticated
-- business attachment. Unknown email-only history remains unbound; no GET
-- creates a session or guesses an account from a current matching address.
do $historybackfill229$
begin
 insert into public.tracking_sessions(reference,state,workspace_id,owner_user_id,created_by,origin_kind,shipment_id,route,cargo_summary,pickup_date,delivery_date,provider_location_consent)
 select p.code,'CONNECTED',c.business_workspace_id,c.owner_actor_id,c.owner_actor_id,'AUTHORIZED_SHIPMENT',p.id,route.points,p.cargo_summary,p.expected_pickup_date,p.expected_delivery_date,p.tracking_mode='LOCATION_AND_STATUS'
 from public.tracking_sharing_controls c join public.provider_shipments p on p.id=c.shipment_id
 join public.provider_tracking_recipients r on r.id=c.owner_recipient_id and r.shipment_id=p.id
 cross join lateral(select public.tracking_route_projection(p.id)as points)route
 where c.owner_actor_id is not null and r.recipient_role='OWNER'and r.revoked_at is null
 and public.business_customer_identity(c.owner_actor_id,false)and public.tracking_business_share_active(p.id,c.business_workspace_id)
 and p.operational_status<>'CANCELLED'and(p.guest_expires_at is null or p.guest_expires_at>clock_timestamp())
 and jsonb_typeof(route.points)='array'and jsonb_array_length(route.points)between 2 and 3
 and not exists(select 1 from jsonb_array_elements(route.points)point where jsonb_typeof(point)is distinct from 'object'
  or jsonb_typeof(point->'placeRef')is distinct from 'string'or nullif(point->>'placeRef','')is null
  or jsonb_typeof(point->'label')is distinct from 'string'or nullif(point->>'label','')is null
  or case when jsonb_typeof(point->'coordinate')='array'then
   case when jsonb_array_length(point->'coordinate')=2 and jsonb_typeof(point->'coordinate'->0)='number'and jsonb_typeof(point->'coordinate'->1)='number'
    then(point->'coordinate'->>0)::numeric not between -180 and 180 or(point->'coordinate'->>1)::numeric not between -90 and 90 else true end
   else true end)
 and not exists(select 1 from public.tracking_sessions s where s.shipment_id=p.id);
end $historybackfill229$;
notify pgrst,'reload schema';
commit;
