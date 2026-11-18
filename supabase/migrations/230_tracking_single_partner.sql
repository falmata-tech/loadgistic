-- FEAT-TRK-001 / NR-87. Only new explicitly unpartnered shipments can be assigned later.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.tracking_sessions add column awaiting_partner boolean not null default false,
 add constraint tracking_waiting_partner_scope check (not awaiting_partner or
 (state='CONNECTED' and origin_kind='AUTHORIZED_SHIPMENT' and workspace_id is null and owner_user_id is null));

create function public.start_tracking_without_partner(actor_user_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare created jsonb; p public.provider_shipments%rowtype;
begin
 if command is null or jsonb_typeof(command)<>'object' or exists(select 1 from jsonb_object_keys(command) k where k not in
 ('id','code','vehicle_id','origin_place_ref','passing_place_ref','destination_place_ref','cargo_summary','expected_pickup_date','expected_delivery_date','tracking_mode')) then raise exception 'INVALID_TRACKING_INPUT';end if;
 if not exists(select 1 from public.provider_tracking_actor_scope(actor_user_id) a where a.can_manage_tracking and a.workspace_access) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('tracking-session-bind:'||(command->>'id'),0));
 created:=public.create_tracking_session_shipment(actor_user_id,command);
 select * into strict p from public.provider_shipments where id=(created->>'id')::uuid;
 insert into public.tracking_sessions(reference,state,created_by,origin_kind,shipment_id,route,cargo_summary,pickup_date,delivery_date,provider_location_consent,awaiting_partner)
 values(p.code,'CONNECTED',actor_user_id,'AUTHORIZED_SHIPMENT',p.id,public.tracking_route_projection(p.id),p.cargo_summary,p.expected_pickup_date,p.expected_delivery_date,p.tracking_mode='LOCATION_AND_STATUS',true);
 return created;
end $$;

create function public.attach_tracking_partner(actor_user_id uuid,target_shipment_id uuid,partner_email text,recipient_digest text) returns boolean
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare s public.tracking_sessions%rowtype; p public.provider_shipments%rowtype; account_id uuid; input_email text:=lower(trim(partner_email));
begin
 select * into s from public.tracking_sessions where shipment_id=target_shipment_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 perform public.tracking229_lock_actor(actor_user_id,s);
 if public.provider_tracking_actor_owns_shipment(actor_user_id,target_shipment_id) is distinct from true then raise exception 'NOT_FOUND';end if;
 select * into strict p from public.provider_shipments where id=target_shipment_id for update;
 if not s.awaiting_partner or s.owner_user_id is not null or s.workspace_id is not null or p.shipper_email is not null
 or p.operational_status in ('COMPLETED','CANCELLED') or public.tracking229_source_active(s) is distinct from true
 or exists(select 1 from public.provider_tracking_recipients r where r.shipment_id=p.id and r.recipient_role='OWNER')
 then raise exception 'TRACKING_SESSION_CHANGED';end if;
 if recipient_digest is null or recipient_digest!~'^[a-f0-9]{64}$' then raise exception 'INVALID_TRACKING_INPUT';end if;
 select u.id into account_id from auth.users u join public.profiles profile on profile.id=u.id
 where lower(trim(u.email))=input_email and u.email_confirmed_at is not null and public.business_customer_identity(u.id,false)
 and public.business_review_identity(u.id)=public.business_shipment_review_scope(p.id) for share of u,profile;
 if account_id is null then raise exception 'TRACKING_REGISTERED_OWNER_REQUIRED';end if;
 insert into public.provider_tracking_recipients(shipment_id,recipient_role,recipient_email,recipient_email_digest,created_by)
 values(p.id,'OWNER',input_email,recipient_digest,actor_user_id);
 update public.provider_shipments set shipper_email=input_email,updated_at=clock_timestamp() where id=p.id;
 update public.tracking_sessions set owner_user_id=account_id,awaiting_partner=false,revision=revision+1,updated_at=clock_timestamp() where id=s.id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'TRACKING_PARTNER_ADDED','provider_shipment',p.id,'{}');
 return true;
end $$;

-- Add the capability only to an already-authorized provider detail.
do $patch$
declare definition text; anchor text:='return result||jsonb_build_object(''route'',';
begin
 if (select md5(prosrc) from pg_proc where oid='public.provider_tracking_detail(uuid,text)'::regprocedure)<>'ea8d242a8eca471044ad521d465e74da' then raise exception 'TRACKING230_DETAIL_DRIFT';end if;
 definition:=pg_get_functiondef('public.provider_tracking_detail(uuid,text)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'TRACKING230_DETAIL_DRIFT';end if;
 execute replace(definition,anchor,
 'return result||jsonb_build_object(''can_add_partner'',exists(select 1 from public.tracking_sessions s where s.shipment_id=(result->>''id'')::uuid and s.awaiting_partner and result->>''operational_status'' not in(''COMPLETED'',''CANCELLED'') and public.tracking229_source_active(s) and public.provider_tracking_actor_owns_shipment(actor_user_id,s.shipment_id)),''route'',');
end $patch$;
revoke all on function public.start_tracking_without_partner(uuid,jsonb),public.attach_tracking_partner(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.start_tracking_without_partner(uuid,jsonb),public.attach_tracking_partner(uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
