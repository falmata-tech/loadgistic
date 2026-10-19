-- FEAT-ENT/TRK-001: one primary owner, independently scoped status viewers and
-- explicit business-staff position grants. Service adapters verify all sessions.
begin;
select pg_advisory_xact_lock(8030162);
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.provider_tracking_recipients alter column created_by drop not null,
 add column display_name text check(display_name is null or length(display_name) between 1 and 80),
 add column shared_by_recipient_id uuid references public.provider_tracking_recipients(id) on delete cascade,
 add column revoked_by_recipient_id uuid references public.provider_tracking_recipients(id) on delete set null;
create table public.tracking_sharing_controls(
 shipment_id uuid primary key references public.provider_shipments(id) on delete cascade,
 revision integer not null default 0 check(revision>=0),
 owner_recipient_id uuid not null references public.provider_tracking_recipients(id) on delete cascade,
 business_workspace_id uuid references public.business_workspaces(id),
 owner_actor_id uuid references public.profiles(id) on delete set null,
 updated_at timestamptz not null default clock_timestamp()
);
create table public.tracking_staff_location_grants(
 shipment_id uuid not null references public.provider_shipments(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 workspace_id uuid not null references public.business_workspaces(id) on delete cascade,
 member_revision integer not null check(member_revision>0),
 granted_by_recipient_id uuid not null references public.provider_tracking_recipients(id) on delete cascade,
 granted_at timestamptz not null default clock_timestamp(),revoked_at timestamptz,
 primary key(shipment_id,user_id)
);
create table public.tracking_sharing_audit(
 id uuid primary key default gen_random_uuid(),shipment_id uuid references public.provider_shipments(id) on delete set null,
 actor_recipient_id uuid references public.provider_tracking_recipients(id) on delete set null,
 actor_user_id uuid references public.profiles(id) on delete set null,
 action text not null check(action in('ADD_VIEWER','REVOKE_VIEWER','ATTACH_BUSINESS','DETACH_BUSINESS','ALLOW_LOCATION','REMOVE_LOCATION')),
 subject_id uuid,created_at timestamptz not null default clock_timestamp()
);
create index tracking_business_shipment_lookup on public.tracking_sharing_controls(business_workspace_id,shipment_id) where business_workspace_id is not null;
do $private$ declare name text;begin
 foreach name in array array['tracking_sharing_controls','tracking_staff_location_grants','tracking_sharing_audit'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on public.%I from public,anon,authenticated',name);
  execute format('grant select,insert,update,delete on public.%I to service_role',name);
 end loop;
end $private$;

create function public.tracking_fresh_owner_recipient(target_shipment_id uuid,recipient_digest text,verified_at timestamptz) returns uuid
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare recipient uuid;
begin
 if verified_at is null or verified_at>clock_timestamp() or verified_at<=clock_timestamp()-interval '5 minutes' then raise exception 'TRACKING_SESSION_EXPIRED';end if;
 select r.id into recipient from provider_tracking_recipients r join provider_shipments s on s.id=r.shipment_id
  join shipment_party_grants g on g.shipment_id=s.id and g.party_role='SHIPPER'
  where r.shipment_id=target_shipment_id and r.recipient_email_digest=recipient_digest and r.recipient_role='OWNER' and r.revoked_at is null
   and g.revoked_at is null and(g.expires_at is null or g.expires_at>clock_timestamp())
   and(s.guest_expires_at is null or s.guest_expires_at>clock_timestamp());
 if recipient is null then raise exception 'TRACKING_APPROVAL_FORBIDDEN';end if;
 return recipient;
end $$;
create function public.tracking_owner_is_member_identity(actor_user_id uuid,owner_recipient_id uuid) returns boolean
language sql stable security definer set search_path=public,auth,pg_temp as $$
 select public.business_customer_identity(actor_user_id,false) and exists(select 1 from auth.users u join provider_tracking_recipients r
  on lower(trim(u.email))=r.recipient_email where u.id=actor_user_id and r.id=owner_recipient_id and r.recipient_role='OWNER' and r.revoked_at is null)
$$;
create function public.tracking_business_share_active(target_shipment_id uuid,target_workspace_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from tracking_sharing_controls c join provider_tracking_recipients r on r.id=c.owner_recipient_id
  join provider_shipments s on s.id=c.shipment_id join shipment_party_grants g on g.shipment_id=s.id and g.party_role='SHIPPER'
  where c.shipment_id=target_shipment_id and c.business_workspace_id=target_workspace_id and r.shipment_id=s.id and r.recipient_role='OWNER'
   and r.revoked_at is null and g.revoked_at is null and(g.expires_at is null or g.expires_at>clock_timestamp())
   and(s.guest_expires_at is null or s.guest_expires_at>clock_timestamp())
   and public.tracking_owner_is_member_identity(c.owner_actor_id,r.id)
   and public.business_workspace_permission(c.owner_actor_id,target_workspace_id,'TRACKING'))
$$;

create function public.tracking_owner_sharing(target_shipment_id uuid,recipient_digest text,verified_at timestamptz) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare owner_id uuid;control tracking_sharing_controls%rowtype;result jsonb;
begin
 owner_id:=public.tracking_fresh_owner_recipient(target_shipment_id,recipient_digest,verified_at);
 select * into control from tracking_sharing_controls where shipment_id=target_shipment_id;
 return jsonb_build_object('shipmentId',target_shipment_id,'revision',coalesce(control.revision,0),
  'canInvite',(select operational_status not in('COMPLETED','CANCELLED') from provider_shipments where id=target_shipment_id),
  'viewers',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',coalesce(r.display_name,''),'email',r.recipient_email,
   'revoked',r.revoked_at is not null,'createdAt',r.created_at) order by r.created_at,r.id)
   from provider_tracking_recipients r where r.shipment_id=target_shipment_id and r.recipient_role<>'OWNER' and r.revoked_at is null),'[]'::jsonb),
  'business',(select jsonb_build_object('id',w.id,'name',w.name,'handle',w.handle,'active',public.tracking_business_share_active(target_shipment_id,w.id))
   from business_workspaces w where w.id=control.business_workspace_id),
  'staff',coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'firstName',public.public_person_first_name(m.user_id),
   'locationAllowed',exists(select 1 from tracking_staff_location_grants l where l.shipment_id=target_shipment_id and l.user_id=m.user_id
    and l.workspace_id=m.workspace_id and l.member_revision=m.revision and l.revoked_at is null)) order by m.user_id)
   from business_workspace_members m where m.workspace_id=control.business_workspace_id and m.user_id<>control.owner_actor_id
    and public.business_workspace_permission(m.user_id,m.workspace_id,'TRACKING')
    and public.tracking_business_share_active(target_shipment_id,m.workspace_id)),'[]'::jsonb));
end $$;

create function public.tracking_owner_sharing_command(target_shipment_id uuid,recipient_digest text,verified_at timestamptz,command jsonb,actor_user_id uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare owner_id uuid;control tracking_sharing_controls%rowtype;action_value text:=command->>'action';subject uuid;workspace uuid;member_revision integer;
 clean_email text:=lower(trim(command->>'email'));clean_name text:=trim(command->>'name');digest text:=command->>'digest';stamp timestamptz:=clock_timestamp();
begin
 perform 1 from provider_shipments where id=target_shipment_id for update;
 owner_id:=public.tracking_fresh_owner_recipient(target_shipment_id,recipient_digest,verified_at);
 if action_value is null or action_value not in('ADD_VIEWER','REVOKE_VIEWER','ATTACH_BUSINESS','DETACH_BUSINESS','ALLOW_LOCATION','REMOVE_LOCATION')
  or jsonb_typeof(command->'expectedRevision')<>'number' then raise exception 'INVALID_TRACKING_RECIPIENTS';end if;
 insert into tracking_sharing_controls(shipment_id,owner_recipient_id) values(target_shipment_id,owner_id) on conflict do nothing;
 select * into control from tracking_sharing_controls where shipment_id=target_shipment_id for update;
 if (command->>'expectedRevision')::integer is distinct from control.revision or control.owner_recipient_id<>owner_id then raise exception 'TRACKING_SHARING_CHANGED';end if;
 if action_value in('ADD_VIEWER','ATTACH_BUSINESS','ALLOW_LOCATION') and exists(select 1 from provider_shipments where id=target_shipment_id and operational_status in('COMPLETED','CANCELLED')) then raise exception 'TRACKING_RECIPIENTS_CLOSED';end if;
 if action_value='ADD_VIEWER' then
  if clean_email is null or clean_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(clean_email)>254
   or clean_name is null or length(clean_name) not between 1 and 80 or digest is null or digest!~'^[a-f0-9]{64}$' then raise exception 'INVALID_TRACKING_RECIPIENTS';end if;
  if exists(select 1 from provider_tracking_recipients where shipment_id=target_shipment_id and recipient_email_digest=digest and revoked_at is null) then raise exception 'TRACKING_RECIPIENT_EXISTS';end if;
  if(select count(*) from provider_tracking_recipients where shipment_id=target_shipment_id and revoked_at is null)>=21 then raise exception 'TRACKING_RECIPIENT_LIMIT';end if;
  insert into provider_tracking_recipients(shipment_id,recipient_role,recipient_email,recipient_email_digest,display_name,shared_by_recipient_id)
   values(target_shipment_id,'TRACKING_PARTY',clean_email,digest,clean_name,owner_id) returning id into subject;
  insert into email_deliveries(id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status,attempts,next_attempt_at,created_at,updated_at)
   values(gen_random_uuid(),target_shipment_id,'RECEIVER','TRACKING_ACCESS',clean_email,'tracking-access:'||target_shipment_id||':'||subject,'PENDING',0,stamp,stamp,stamp);
 elsif action_value='REVOKE_VIEWER' then
  subject:=(command->>'recipientId')::uuid;
  perform 1 from provider_tracking_recipients where id=subject and shipment_id=target_shipment_id and recipient_role='TRACKING_PARTY' for update;
  if not found then raise exception 'TRACKING_ACCESS_DENIED';end if;
  update provider_tracking_recipients set revoked_at=coalesce(revoked_at,stamp),revoked_by_recipient_id=owner_id where id=subject;
  update provider_tracking_email_otps set superseded_at=stamp where recipient_id=subject and used_at is null and superseded_at is null;
 elsif action_value='ATTACH_BUSINESS' then
  workspace:=(command->>'workspaceId')::uuid;
  perform 1 from business_workspaces where id=workspace for update;
  if not public.tracking_owner_is_member_identity(actor_user_id,owner_id) or not public.business_workspace_permission(actor_user_id,workspace,'TRACKING') then raise exception 'BUSINESS_FORBIDDEN';end if;
  update tracking_staff_location_grants set revoked_at=coalesce(revoked_at,stamp) where shipment_id=target_shipment_id;
  update tracking_sharing_controls set business_workspace_id=workspace,owner_actor_id=actor_user_id where shipment_id=target_shipment_id;
  subject:=workspace;
 elsif action_value='DETACH_BUSINESS' then
  subject:=control.business_workspace_id;
  update tracking_staff_location_grants set revoked_at=coalesce(revoked_at,stamp) where shipment_id=target_shipment_id;
  update tracking_sharing_controls set business_workspace_id=null,owner_actor_id=null where shipment_id=target_shipment_id;
 else
  subject:=(command->>'userId')::uuid;workspace:=control.business_workspace_id;
  perform 1 from business_workspaces where id=workspace for update;
  if workspace is null or not public.tracking_business_share_active(target_shipment_id,workspace) then raise exception 'BUSINESS_FORBIDDEN';end if;
  if action_value='ALLOW_LOCATION' then
   select m.revision into member_revision from business_workspace_members m where m.workspace_id=workspace and m.user_id=subject
    and public.business_workspace_permission(subject,workspace,'TRACKING') for share;
   if member_revision is null or subject=control.owner_actor_id then raise exception 'BUSINESS_FORBIDDEN';end if;
   insert into tracking_staff_location_grants(shipment_id,user_id,workspace_id,member_revision,granted_by_recipient_id)
    values(target_shipment_id,subject,workspace,member_revision,owner_id)
    on conflict(shipment_id,user_id) do update set workspace_id=excluded.workspace_id,member_revision=excluded.member_revision,
     granted_by_recipient_id=excluded.granted_by_recipient_id,granted_at=stamp,revoked_at=null;
  else update tracking_staff_location_grants set revoked_at=coalesce(revoked_at,stamp) where shipment_id=target_shipment_id and user_id=subject;end if;
 end if;
 update tracking_sharing_controls set revision=revision+1,updated_at=stamp where shipment_id=target_shipment_id;
 insert into tracking_sharing_audit(shipment_id,actor_recipient_id,actor_user_id,action,subject_id) values(target_shipment_id,owner_id,case when action_value='ATTACH_BUSINESS' then actor_user_id else null end,action_value,subject);
 return public.tracking_owner_sharing(target_shipment_id,recipient_digest,verified_at);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'INVALID_TRACKING_RECIPIENTS';
end $$;

-- Provider forms publish one primary recipient. Later sharing belongs to that
-- verified owner, including callers retaining an older app or API contract.
alter function public.create_provider_tracking_with_recipients(uuid,jsonb) rename to create_provider_tracking_with_recipients_pre_sharing162;
create function public.create_provider_tracking_with_recipients(actor_user_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if command?'additional_recipients' and (jsonb_typeof(command->'additional_recipients')<>'array' or jsonb_array_length(command->'additional_recipients')<>0) then raise exception 'TRACKING_OWNER_SHARES_ACCESS';end if;
 return public.create_provider_tracking_with_recipients_pre_sharing162(actor_user_id,command-'additional_recipients');
end $$;
create or replace function public.add_provider_tracking_recipient(actor_user_id uuid,target_shipment_id uuid,normalized_recipient_email text,recipient_digest text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$begin raise exception 'TRACKING_OWNER_SHARES_ACCESS';end $$;
create or replace function public.revoke_provider_tracking_recipient(actor_user_id uuid,target_shipment_id uuid,target_recipient_id uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$begin raise exception 'TRACKING_OWNER_SHARES_ACCESS';end $$;
create or replace function public.list_provider_tracking_recipients(actor_user_id uuid,target_shipment_id uuid) returns table(payload jsonb)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.provider_tracking_actor_owns_shipment(actor_user_id,target_shipment_id) then raise exception 'NOT_FOUND';end if;
 return query select jsonb_build_object('id',r.id,'recipient_role',r.recipient_role,'recipient_email',r.recipient_email,'created_at',r.created_at,'revoked_at',r.revoked_at)
  from provider_tracking_recipients r where r.shipment_id=target_shipment_id and r.recipient_role='OWNER';
end $$;

alter function public.provider_guest_tracking_for_recipient(uuid,text) rename to provider_guest_tracking_for_recipient_pre_sharing162;
create function public.provider_guest_tracking_for_recipient(target_shipment_id uuid,requested_recipient_digest text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from provider_tracking_recipients where shipment_id=target_shipment_id and recipient_role='OWNER' and revoked_at is null) then return null;end if;
 result:=public.provider_guest_tracking_for_recipient_pre_sharing162(target_shipment_id,requested_recipient_digest);
 if result is null then return null;end if;
 return result||jsonb_build_object('can_share',result->>'recipient_role'='OWNER');
end $$;

create function public.business_tracking_detail(actor_user_id uuid,target_workspace_id uuid,target_shipment_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare result jsonb;owner_id uuid;is_owner boolean;can_locate boolean;
begin
 if not public.business_workspace_permission(actor_user_id,target_workspace_id,'TRACKING') or not public.tracking_business_share_active(target_shipment_id,target_workspace_id) then raise exception 'BUSINESS_FORBIDDEN';end if;
 select owner_recipient_id into owner_id from tracking_sharing_controls where shipment_id=target_shipment_id;
 is_owner:=public.tracking_owner_is_member_identity(actor_user_id,owner_id);
 can_locate:=is_owner or exists(select 1 from tracking_staff_location_grants l join business_workspace_members m on m.workspace_id=l.workspace_id and m.user_id=l.user_id
  where l.shipment_id=target_shipment_id and l.workspace_id=target_workspace_id and l.user_id=actor_user_id and l.revoked_at is null and m.revision=l.member_revision);
 result:=public.provider_guest_tracking(target_shipment_id,'SHIPPER');
 if result is null then raise exception 'NOT_FOUND';end if;
 result:=result||jsonb_build_object('recipient_role',case when is_owner then 'BUSINESS_OWNER' else 'BUSINESS_STAFF' end,
  'current_location',case when can_locate then public.tracking_selected_location(target_shipment_id) else null end,
  'can_view_location',can_locate,'can_share',false,'can_approve',false,'can_review',false,'review',null);
 result:=jsonb_set(result,'{events}',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'note',coalesce(e.note,''),
  'created_at',e.created_at,'has_proof',false) order by e.created_at,e.id) from provider_shipment_events e where e.shipment_id=target_shipment_id and e.event_type='STATUS'),'[]'::jsonb));
 return jsonb_build_object('workspaceId',target_workspace_id,'isOwner',is_owner,'shipment',result);
end $$;
create function public.business_tracking_workspace(actor_user_id uuid,target_workspace_id uuid,requested_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare total_count integer;page integer;items jsonb;
begin
 if not public.business_workspace_permission(actor_user_id,target_workspace_id,'TRACKING') then raise exception 'BUSINESS_FORBIDDEN';end if;
 select count(*) into total_count from tracking_sharing_controls c where c.business_workspace_id=target_workspace_id and public.tracking_business_share_active(c.shipment_id,target_workspace_id);
 page:=greatest(1,least(coalesce(requested_page,1),greatest(1,ceil(total_count/20.0)::integer)));
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'code',s.code,'origin',s.origin,'destination',s.destination,'cargo',s.cargo_summary,
  'status',s.operational_status,'driver','','truck','','updatedAt',s.updated_at) order by s.updated_at desc,s.id),'[]'::jsonb) into items
  from(select s.* from provider_shipments s join tracking_sharing_controls c on c.shipment_id=s.id
   where c.business_workspace_id=target_workspace_id and public.tracking_business_share_active(s.id,target_workspace_id)
   order by s.updated_at desc,s.id limit 20 offset(page-1)*20) s;
 return jsonb_build_object('workspaceId',target_workspace_id,'total',total_count,'page',page,'pageCount',greatest(1,ceil(total_count/20.0)::integer),'shipments',items);
end $$;

-- A genuine selected phone has one dated approximate point. Accepted shipment
-- background reports must also keep that truck's capacity point coherent. Reuse
-- the governed refresh and never re-obscure or narrow this already obscured fix.
create function public.apply_registered_tracking_phone_point(actor_user_id uuid,target_vehicle_id uuid,target_binding_id uuid,observed_at timestamptz,location jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare result jsonb;
begin
 if not exists(select 1 from phone_location_bindings b where b.id=target_binding_id and b.actor_user_id=actor_user_id and b.vehicle_id=target_vehicle_id
  and public.phone_location_binding_is_current(b.id))
  or coalesce((select source from telematics_location_sources where vehicle_id=target_vehicle_id),'MOBILE')<>'MOBILE' then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 result:=public.refresh_provider_capacity_location_pre_phone157(actor_user_id,jsonb_build_object('vehicle_id',target_vehicle_id,
  'approximate_lat',location->'lat','approximate_lng',location->'lng','location_precision_km',location->'precision_km'));
 update vehicle_driver_locations set phone_binding_id=target_binding_id,observed_at=observed_at,updated_at=observed_at,demo_epoch=null
  where vehicle_id=target_vehicle_id and driver_user_id=actor_user_id;
 update capacities set location_updated_at=observed_at,demo_epoch=null where id=(result->>'capacityId')::uuid and location_source='DEVICE_OBSCURED';
end $$;
alter function public.update_provider_tracking_location(uuid,uuid,jsonb) rename to update_provider_tracking_location_pre_coherence162;
create function public.update_provider_tracking_location(actor_user_id uuid,target_shipment_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;vehicle uuid;binding uuid;
begin
 result:=public.update_provider_tracking_location_pre_coherence162(actor_user_id,target_shipment_id,command);
 if command?'phone_installation' and result->>'recorded'='true' then
  select assigned_vehicle_id into vehicle from provider_shipments where id=target_shipment_id;
  binding:=(command->'phone_installation'->>'binding_id')::uuid;
  perform public.apply_registered_tracking_phone_point(actor_user_id,vehicle,binding,(command->'phone_installation'->>'observed_at')::timestamptz,command);
 end if;
 return result;
end $$;
alter function public.update_provider_tracking_status(uuid,uuid,jsonb) rename to update_provider_tracking_status_pre_coherence162;
create function public.update_provider_tracking_status(actor_user_id uuid,target_shipment_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;vehicle uuid;binding uuid;
begin
 result:=public.update_provider_tracking_status_pre_coherence162(actor_user_id,target_shipment_id,command);
 if command->'location'?'phone_installation' then
  select assigned_vehicle_id into vehicle from provider_shipments where id=target_shipment_id;
  binding:=(command->'location'->'phone_installation'->>'binding_id')::uuid;
  perform public.apply_registered_tracking_phone_point(actor_user_id,vehicle,binding,(command->'location'->'phone_installation'->>'observed_at')::timestamptz,command->'location');
 end if;
 return result;
end $$;

do $permissions$ declare fn regprocedure;begin
 foreach fn in array array[
  'public.tracking_fresh_owner_recipient(uuid,text,timestamptz)'::regprocedure,'public.tracking_owner_is_member_identity(uuid,uuid)'::regprocedure,
  'public.tracking_business_share_active(uuid,uuid)'::regprocedure,'public.tracking_owner_sharing(uuid,text,timestamptz)'::regprocedure,
  'public.tracking_owner_sharing_command(uuid,text,timestamptz,jsonb,uuid)'::regprocedure,
  'public.create_provider_tracking_with_recipients_pre_sharing162(uuid,jsonb)'::regprocedure,
  'public.provider_guest_tracking_for_recipient_pre_sharing162(uuid,text)'::regprocedure,
  'public.apply_registered_tracking_phone_point(uuid,uuid,uuid,timestamptz,jsonb)'::regprocedure,
  'public.update_provider_tracking_location_pre_coherence162(uuid,uuid,jsonb)'::regprocedure,
  'public.update_provider_tracking_status_pre_coherence162(uuid,uuid,jsonb)'::regprocedure,
  'public.business_tracking_detail(uuid,uuid,uuid)'::regprocedure,'public.business_tracking_workspace(uuid,uuid,integer)'::regprocedure
 ] loop execute format('revoke all on function %s from public,anon,authenticated,service_role',fn);end loop;
end $permissions$;
grant execute on function public.tracking_owner_sharing(uuid,text,timestamptz),public.tracking_owner_sharing_command(uuid,text,timestamptz,jsonb,uuid),
 public.business_tracking_detail(uuid,uuid,uuid),public.business_tracking_workspace(uuid,uuid,integer) to service_role;
revoke all on function public.create_provider_tracking_with_recipients(uuid,jsonb),public.add_provider_tracking_recipient(uuid,uuid,text,text),
 public.revoke_provider_tracking_recipient(uuid,uuid,uuid),public.list_provider_tracking_recipients(uuid,uuid),public.provider_guest_tracking_for_recipient(uuid,text) from public,anon,authenticated;
grant execute on function public.create_provider_tracking_with_recipients(uuid,jsonb),public.add_provider_tracking_recipient(uuid,uuid,text,text),
 public.revoke_provider_tracking_recipient(uuid,uuid,uuid),public.list_provider_tracking_recipients(uuid,uuid),public.provider_guest_tracking_for_recipient(uuid,text) to service_role;
revoke all on function public.update_provider_tracking_location(uuid,uuid,jsonb),public.update_provider_tracking_status(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.update_provider_tracking_location(uuid,uuid,jsonb),public.update_provider_tracking_status(uuid,uuid,jsonb) to service_role;
commit;
