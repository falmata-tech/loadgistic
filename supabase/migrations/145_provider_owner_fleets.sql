-- FEAT-FLT-001 / FEAT-IAM-001 / ADR-079. Preserve both historical owner anchors.
-- Registration is private Draft; migration 146 supplies reviewed publication.
begin;
select pg_advisory_xact_lock(8030145);

create table public.provider_fleet_145_function_backup(
 signature text primary key, definition text not null, owner_name text not null,
 acl text, settings text[], comment_text text
);
alter table public.provider_fleet_145_function_backup enable row level security;
revoke all on public.provider_fleet_145_function_backup from public,anon,authenticated,service_role;
insert into public.provider_fleet_145_function_backup
select p.oid::regprocedure::text,pg_get_functiondef(p.oid),p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in(
 'fleet_owner_organization','fleet_invitation_joinable','fleet_invite_driver','fleet_pending_invitations',
 'fleet_identity_invitations','fleet_accept_invitation','fleet_cancel_invitation','fleet_claim_invitation_email',
 'fleet_update_driver_contact','fleet_remove_driver','fleet_driver_registration_target','fleet_register_driver',
 'fleet_driver_page','update_fleet_driver_access','create_provider_vehicle','update_provider_vehicle_details',
 'set_vehicle_lifecycle','capacity_active_driver_id','provider_capacity_actor_scope','provider_tracking_actor_scope',
 'provider_profile_actor_scope','current_user_projection','has_workspace_access',
 'provider_capacity_workspace','publish_provider_capacity','refresh_provider_capacity_location',
 'set_provider_assigned_vehicle_duty','bootstrap_driver_vehicle_location','provider_tracking_workspace',
 'provider_tracking_actor_owns_shipment','create_provider_tracking','update_provider_tracking_status',
 'update_provider_tracking_location','verification_actor_owns_vehicle','verification_workspace',
 'submit_verification_request','verification_submission_subject','tracking_register_driver_device',
 'tracking_driver_device_context','tracking_owner_handover_context'
);

alter table public.profiles add column drives_truck boolean not null default false;
update public.profiles p set drives_truck=true where p.role='DRIVER'
 and exists(select 1 from public.provider_profiles owner where owner.user_id=p.id);
alter table public.vehicles add column publication_status text;
update public.vehicles set publication_status='LIVE';
alter table public.vehicles alter column publication_status set default 'DRAFT';
alter table public.vehicles alter column publication_status set not null;
alter table public.vehicles add constraint vehicle_publication_status_check check(publication_status in('DRAFT','LIVE'));
alter table public.vehicles drop constraint vehicles_use_basis_check;
alter table public.vehicles add constraint vehicles_use_basis_check check(use_basis in('OWNED','FINANCED','PERMISSION'));
drop index public.one_independent_active_vehicle;
alter table public.platform_controls drop constraint platform_controls_independent_single_truck_check;
update public.platform_controls set independent_single_truck=false;

alter table public.drivers alter column organization_id drop not null;
alter table public.drivers add column provider_profile_id uuid references public.provider_profiles(id);
alter table public.drivers add constraint driver_employer_scope_check check(num_nonnulls(organization_id,provider_profile_id)=1);
create index driver_personal_provider_scope_idx on public.drivers(provider_profile_id,user_id) where provider_profile_id is not null;
alter table public.fleet_driver_invitations alter column organization_id drop not null;
alter table public.fleet_driver_invitations add column provider_profile_id uuid references public.provider_profiles(id);
alter table public.fleet_driver_invitations add constraint invitation_provider_scope_check check(num_nonnulls(organization_id,provider_profile_id)=1);
create unique index fleet_personal_provider_invitation_pending_idx on public.fleet_driver_invitations(provider_profile_id,email)
 where provider_profile_id is not null and accepted_at is null and cancelled_at is null;

create function public.fleet_provider_owner_scope(actor_user_id uuid)
returns table(organization_id uuid,provider_profile_id uuid)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare scope_count integer;
begin
 select count(*) into scope_count from(
  select m.organization_id from public.profiles p join public.organization_members m on m.user_id=p.id and m.membership_role='OWNER'
   where p.id=actor_user_id and p.active and p.role='TRANSPORTER'
  union all
  select x.id from public.profiles p join public.provider_profiles x on x.user_id=p.id
   where p.id=actor_user_id and p.active and p.role='DRIVER'
 ) scopes;
 if scope_count<>1 then raise exception 'FORBIDDEN';end if;
 return query
 select m.organization_id,null::uuid from public.profiles p join public.organization_members m on m.user_id=p.id and m.membership_role='OWNER'
  where p.id=actor_user_id and p.active and p.role='TRANSPORTER'
 union all
 select null::uuid,x.id from public.profiles p join public.provider_profiles x on x.user_id=p.id
  where p.id=actor_user_id and p.active and p.role='DRIVER';
end $$;

create function public.fleet_lock_provider_owner(actor_user_id uuid)
returns table(organization_id uuid,provider_profile_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
declare s record;
begin
 select * into s from public.fleet_provider_owner_scope(actor_user_id);
 if s.organization_id is not null then perform 1 from public.organizations o where o.id=s.organization_id for update;
 else perform 1 from public.provider_profiles x where x.id=s.provider_profile_id for update;end if;
 -- Recheck current owner authority after waiting for a concurrent change.
 return query select * from public.fleet_provider_owner_scope(actor_user_id);
end $$;

create function public.fleet_driver_matches_scope(target_driver_id uuid,owner_org uuid,owner_provider uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles p where p.id=target_driver_id and p.active and(
  p.drives_truck and (
   owner_org is not null and p.role='TRANSPORTER' and exists(select 1 from public.organization_members m
    where m.user_id=p.id and m.organization_id=owner_org and m.membership_role='OWNER')
   or owner_provider is not null and p.role='DRIVER' and exists(select 1 from public.provider_profiles x
    where x.id=owner_provider and x.user_id=p.id))
  or p.role='DRIVER' and exists(select 1 from public.drivers d where d.user_id=p.id and d.active
   and d.organization_id is not distinct from owner_org and d.provider_profile_id is not distinct from owner_provider
   and (owner_provider is not null or exists(select 1 from public.organization_members m
    where m.user_id=p.id and m.organization_id=owner_org and m.membership_role='DRIVER')))
 ));
$$;

create function public.fleet_actor_can_use_vehicle(actor_user_id uuid,target_vehicle_id uuid,owner_required boolean default false)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.vehicles v join public.profiles p on p.id=actor_user_id and p.active
  where v.id=target_vehicle_id and v.active and(
   p.role='TRANSPORTER' and v.organization_id is not null and exists(select 1 from public.organization_members m
    where m.user_id=p.id and m.organization_id=v.organization_id and m.membership_role='OWNER')
   or p.role='DRIVER' and v.provider_profile_id is not null and exists(select 1 from public.provider_profiles x
    where x.id=v.provider_profile_id and x.user_id=p.id)
   or not owner_required and public.fleet_driver_matches_scope(p.id,v.organization_id,v.provider_profile_id)
    and exists(select 1 from public.driver_vehicle_assignments a where a.driver_user_id=p.id and a.vehicle_id=v.id and a.active)
 ));
$$;

-- Callers hold the exact vehicle row lock before requesting this stamp. A
-- transaction may have begun before another writer committed its newer signal.
create function public.provider_capacity_write_timestamp(target_vehicle_id uuid)
returns timestamptz language sql volatile security definer set search_path=public,pg_temp as $$
 select greatest(clock_timestamp(),coalesce(max(c.updated_at)+interval '1 microsecond','-infinity'::timestamptz))
 from public.capacities c where c.vehicle_id=target_vehicle_id;
$$;
create function public.provider_capacity_pair_started_at(target_vehicle_id uuid)
returns timestamptz language sql stable security definer set search_path=public,pg_temp as $$
 select a.assigned_at from public.driver_vehicle_assignments a where a.vehicle_id=target_vehicle_id and a.active
  and a.driver_user_id=public.capacity_active_driver_id(target_vehicle_id);
$$;

-- Former personal providers had exactly one implicit self-driven truck. Convert
-- that exact relationship once, never attach the owner to subsequent additions.
do $$ begin
 if exists(select 1 from public.vehicles v join public.provider_profiles x on x.id=v.provider_profile_id
  join public.driver_vehicle_assignments a on a.driver_user_id=x.user_id and a.active
  where v.active and a.vehicle_id<>v.id) then raise exception 'LEGACY_DRIVER_ASSIGNMENT_AMBIGUOUS';end if;
 if exists(select 1 from public.driver_vehicle_assignments where active group by driver_user_id having count(*)>1)
  or exists(select 1 from public.driver_vehicle_assignments where active group by vehicle_id having count(*)>1)
  then raise exception 'CURRENT_DRIVER_ASSIGNMENT_AMBIGUOUS';end if;
end $$;
insert into public.driver_vehicle_assignments(driver_user_id,vehicle_id,assigned_by,assigned_at,active)
select x.user_id,v.id,x.user_id,coalesce(p.created_at,now()),true
from public.vehicles v join public.provider_profiles x on x.id=v.provider_profile_id
join public.profiles p on p.id=x.user_id and p.active and p.role='DRIVER'
where v.active
on conflict(driver_user_id,vehicle_id) do update set active=true;
create unique index current_driver_one_vehicle_idx on public.driver_vehicle_assignments(driver_user_id) where active;
create unique index current_vehicle_one_driver_idx on public.driver_vehicle_assignments(vehicle_id) where active;

create or replace function public.capacity_active_driver_id(target_vehicle_id uuid)
returns uuid language sql stable security definer set search_path=public,pg_temp as $$
 select a.driver_user_id from public.vehicles v join public.driver_vehicle_assignments a on a.vehicle_id=v.id and a.active
 where v.id=target_vehicle_id and v.active and public.fleet_driver_matches_scope(a.driver_user_id,v.organization_id,v.provider_profile_id);
$$;

create function public.provider_account_capabilities(actor_user_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
  'owns_provider_account',p.active and (
   p.role='TRANSPORTER' and exists(select 1 from organization_members m where m.user_id=p.id and m.membership_role='OWNER')
   or p.role='DRIVER' and exists(select 1 from provider_profiles x where x.user_id=p.id)),
  'can_manage_fleet',p.active and (
   p.role='TRANSPORTER' and exists(select 1 from organization_members m where m.user_id=p.id and m.membership_role='OWNER')
   or p.role='DRIVER' and exists(select 1 from provider_profiles x where x.user_id=p.id)),
  'drives_truck',p.drives_truck or(p.active and exists(select 1 from drivers d where d.user_id=p.id and d.active
   and public.fleet_driver_matches_scope(p.id,d.organization_id,d.provider_profile_id))),
  'current_driver_id',case when p.active and(p.drives_truck or exists(select 1 from drivers d where d.user_id=p.id and d.active
   and public.fleet_driver_matches_scope(p.id,d.organization_id,d.provider_profile_id))) then p.id end,
  'current_driven_vehicle_id',(select a.vehicle_id from driver_vehicle_assignments a where a.driver_user_id=p.id and a.active
   and public.capacity_active_driver_id(a.vehicle_id)=p.id),
  'employer_provider_profile_id',(select d.provider_profile_id from drivers d where d.user_id=p.id and d.active),
  'driver_kind',case when exists(select 1 from drivers d where d.user_id=p.id and d.active) then 'COMPANY'
   when p.drives_truck then 'SELF_MANAGED' end,
  'provider_operating_model',case when exists(select 1 from drivers d where d.user_id=p.id and d.active) then 'COMPANY_DRIVER'
   when p.role='TRANSPORTER' then 'FLEET_TRANSPORTER' when p.drives_truck then 'SELF_MANAGED_DRIVER' end
 ) from public.profiles p where p.id=actor_user_id;
$$;

create or replace function public.provider_capacity_actor_scope(actor_user_id uuid)
returns table(actor_role text,organization_id uuid,provider_profile_id uuid,is_company_driver boolean,can_manage_capacity boolean,workspace_access boolean)
language sql stable security definer set search_path=public,pg_temp as $$
 select p.role::text,m.organization_id,x.id,p.role='DRIVER' and(d.id is not null or coalesce(m.membership_role='DRIVER',false)),
  case when x.id is not null or m.membership_role='OWNER' then true else coalesce(permission.can_manage_capacity,false) end,
  x.id is not null or m.organization_id is not null or d.provider_profile_id is not null
 from profiles p left join lateral(select member.organization_id,member.membership_role from organization_members member
  where member.user_id=p.id order by case when member.membership_role='OWNER' then 0 else 1 end,member.id limit 1)m on true
 left join provider_profiles x on x.user_id=p.id
 left join drivers d on d.user_id=p.id and d.active
 left join driver_permissions permission on permission.user_id=p.id
 where p.id=actor_user_id and p.active and p.role in('TRANSPORTER','DRIVER');
$$;
create or replace function public.provider_tracking_actor_scope(actor_user_id uuid)
returns table(actor_role text,organization_id uuid,provider_profile_id uuid,is_company_driver boolean,can_manage_tracking boolean,workspace_access boolean)
language sql stable security definer set search_path=public,pg_temp as $$
 select s.actor_role,s.organization_id,s.provider_profile_id,s.is_company_driver,
  case when s.provider_profile_id is not null or s.actor_role='TRANSPORTER' then true else coalesce(p.can_manage_tracking,false) end,s.workspace_access
 from public.provider_capacity_actor_scope(actor_user_id)s left join driver_permissions p on p.user_id=actor_user_id;
$$;
create or replace function public.provider_profile_actor_scope(actor_user_id uuid)
returns table(actor_role text,organization_id uuid,provider_profile_id uuid,is_company_driver boolean,workspace_access boolean)
language sql stable security definer set search_path=public,pg_temp as $$
 select s.actor_role,s.organization_id,s.provider_profile_id,s.is_company_driver,s.workspace_access
 from public.provider_capacity_actor_scope(actor_user_id)s;
$$;

create or replace function public.has_workspace_access()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from profiles p where p.id=auth.uid() and p.active and(
  p.role='ADMIN' or p.role in('TRANSPORTER','DRIVER') and(
   exists(select 1 from organization_members m where m.user_id=p.id)
   or exists(select 1 from provider_profiles x where x.user_id=p.id)
   or exists(select 1 from drivers d where d.user_id=p.id and d.active and d.provider_profile_id is not null))));
$$;

create or replace function public.fleet_driver_page(actor_user_id uuid,requested_offset integer default 0,requested_limit integer default 10)
returns table(payload jsonb,total_count bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare s record;
begin
 select * into s from public.fleet_provider_owner_scope(actor_user_id);
 return query with people as(
  select p.id,p.full_name as name,p.public_callback_phone as phone,p.email,true as is_owner
   from profiles p where p.id=actor_user_id and p.drives_truck
  union all
  select p.id,d.name,d.phone,p.email,false from drivers d join profiles p on p.id=d.user_id and p.active and p.role='DRIVER'
   where d.active and d.organization_id is not distinct from s.organization_id
    and d.provider_profile_id is not distinct from s.provider_profile_id
    and public.fleet_driver_matches_scope(p.id,s.organization_id,s.provider_profile_id)
 ), scoped as(
  select p.*,a.vehicle_id,v.platform_number,v.make,v.model,v.plate,
   case when p.is_owner then true else coalesce(permission.can_manage_capacity,false) end as capacity_allowed,
   case when p.is_owner then true else coalesce(permission.can_manage_tracking,false) end as tracking_allowed
  from people p left join driver_permissions permission on permission.user_id=p.id
  left join driver_vehicle_assignments a on a.driver_user_id=p.id and a.active
  left join vehicles v on v.id=a.vehicle_id and v.active
 ), counted as(select scoped.*,count(*)over() as total from scoped)
 select jsonb_build_object('id',r.id,'name',r.name,'phone',r.phone,'email',r.email,'is_owner',r.is_owner,
  'can_manage_capacity',r.capacity_allowed,'can_manage_tracking',r.tracking_allowed,
  'assigned_vehicle_id',r.vehicle_id,'assigned_vehicles',case when r.vehicle_id is not null then concat_ws(' · ',r.make||' '||r.model,r.platform_number,r.plate) end,
  'driver_documents',coalesce((select jsonb_agg(jsonb_build_object('verification_type',q.verification_type,'reviewed_at',q.reviewed_at,'expires_on',q.expires_on))
   from verification_requests q where q.subject_type='DRIVER' and q.subject_id=r.id and q.status='APPROVED'),'[]'::jsonb),
  'authorization_documents',coalesce((select jsonb_agg(jsonb_build_object('verification_type',q.verification_type,'reviewed_at',q.reviewed_at,'expires_on',q.expires_on,'related_vehicle_id',q.related_vehicle_id))
   from verification_requests q where q.subject_type='DRIVER' and q.subject_id=r.id and q.status='APPROVED'
    and q.verification_type='VEHICLE_AUTHORIZATION' and q.related_vehicle_id=r.vehicle_id),'[]'::jsonb)),r.total
 from counted r order by r.is_owner desc,r.name,r.id
 offset greatest(0,coalesce(requested_offset,0)) limit greatest(1,least(50,coalesce(requested_limit,10)));
end $$;

create or replace function public.update_fleet_driver_access(actor_user_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s record; target_driver uuid;target_vehicle uuid;cap boolean;tracking boolean;displaced integer;
 affected_vehicle uuid;changed_vehicles uuid[]:='{}';stamp timestamptz:=clock_timestamp();changed_truck vehicles%rowtype;previous_visibility capacity_visibility;
begin
 if jsonb_typeof(command) is distinct from 'object' then raise exception 'INVALID_DRIVER_ACCESS';end if;
 begin target_driver:=(command->>'driver_user_id')::uuid;target_vehicle:=nullif(command->>'vehicle_id','')::uuid;
  cap:=coalesce((command->>'can_manage_capacity')::boolean,false);tracking:=coalesce((command->>'can_manage_tracking')::boolean,false);
 exception when others then raise exception 'INVALID_DRIVER_ACCESS';end;
 select * into s from public.fleet_lock_provider_owner(actor_user_id);
 perform 1 from public.profiles p where p.id=target_driver for update;
 if not public.fleet_driver_matches_scope(target_driver,s.organization_id,s.provider_profile_id) then raise exception 'NOT_FOUND';end if;
 if target_driver=actor_user_id and(not cap or not tracking) then raise exception 'INVALID_DRIVER_ACCESS';end if;
 if target_vehicle is not null then
  perform 1 from vehicles v where v.id=target_vehicle and v.active
   and v.organization_id is not distinct from s.organization_id and v.provider_profile_id is not distinct from s.provider_profile_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
 end if;
 -- Never strand unfinished Tracking by moving its assigned person or vehicle.
 if exists(select 1 from provider_shipments shipment where shipment.operational_status not in('COMPLETED','CANCELLED') and(
  shipment.assigned_driver_user_id=target_driver and shipment.assigned_vehicle_id is distinct from target_vehicle
  or target_vehicle is not null and shipment.assigned_vehicle_id=target_vehicle and shipment.assigned_driver_user_id<>target_driver))
  then raise exception 'TRUCK_HAS_ACTIVE_TRACKING';end if;
 if exists(select 1 from driver_vehicle_assignments a join vehicles truck on truck.id=a.vehicle_id
  where a.active and a.driver_user_id=target_driver and(truck.organization_id is distinct from s.organization_id
   or truck.provider_profile_id is distinct from s.provider_profile_id)) then raise exception 'DRIVER_ACCOUNT_CONFLICT';end if;
 select coalesce(array_agg(distinct a.vehicle_id),'{}'::uuid[]) into changed_vehicles from driver_vehicle_assignments a
 where a.active and(a.driver_user_id=target_driver or target_vehicle is not null and a.vehicle_id=target_vehicle)
  and not(target_vehicle is not null and a.driver_user_id=target_driver and a.vehicle_id=target_vehicle);
 if target_vehicle is not null and not exists(select 1 from driver_vehicle_assignments a
  where a.active and a.driver_user_id=target_driver and a.vehicle_id=target_vehicle) then
  changed_vehicles:=array_append(changed_vehicles,target_vehicle);
 end if;
 perform 1 from vehicles truck where truck.id=any(changed_vehicles) order by truck.id for update;
 select greatest(clock_timestamp(),coalesce(max(c.updated_at)+interval '1 microsecond','-infinity'::timestamptz),
  coalesce(max(c.location_updated_at)+interval '1 microsecond','-infinity'::timestamptz),
  coalesce((select max(report.updated_at)+interval '1 microsecond' from vehicle_driver_locations report
   where report.vehicle_id=any(changed_vehicles)),'-infinity'::timestamptz)) into stamp
 from capacities c where c.vehicle_id=any(changed_vehicles);
 with ended as(update driver_vehicle_assignments a set active=false where a.active and(
  a.driver_user_id=target_driver or target_vehicle is not null and a.vehicle_id=target_vehicle)
  and not(target_vehicle is not null and a.driver_user_id=target_driver and a.vehicle_id=target_vehicle) returning 1)
 select count(*) into displaced from ended;
 if target_vehicle is not null then
  insert into driver_vehicle_assignments(driver_user_id,vehicle_id,assigned_by,assigned_at,active)
   values(target_driver,target_vehicle,actor_user_id,stamp,true)
   on conflict(driver_user_id,vehicle_id) do update set assigned_by=excluded.assigned_by,
    assigned_at=case when driver_vehicle_assignments.active then driver_vehicle_assignments.assigned_at else excluded.assigned_at end,active=true;
 end if;
 -- A new pair must report its own position and availability. Keep old snapshots
 -- as history and retain the truck's separate audience/contact preferences.
 for affected_vehicle in select distinct unnest(changed_vehicles) loop
  select * into changed_truck from vehicles where id=affected_vehicle for update;
  stamp:=public.provider_capacity_write_timestamp(changed_truck.id);
  select c.visibility into previous_visibility from capacities c where c.vehicle_id=changed_truck.id order by c.updated_at desc,c.id desc limit 1;
  update capacities set expires_at=stamp where vehicle_id=changed_truck.id and expires_at>stamp;
  insert into capacities(provider_organization_id,provider_profile_id,vehicle_id,status,market_status,available_percent,
   visibility,updated_by,updated_at,expires_at)
  values(changed_truck.organization_id,changed_truck.provider_profile_id,changed_truck.id,'OFF_DUTY','OFF_DUTY',0,
   coalesce(previous_visibility,'PRIVATE'::capacity_visibility),actor_user_id,stamp,stamp);
 end loop;
 if target_driver<>actor_user_id then
  insert into driver_permissions(user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,can_manage_capacity,can_manage_tracking,updated_by)
   values(target_driver,false,false,false,cap,tracking,actor_user_id)
   on conflict(user_id) do update set can_browse_load_board=false,can_contact_businesses=false,can_negotiate_loads=false,
    can_manage_capacity=excluded.can_manage_capacity,can_manage_tracking=excluded.can_manage_tracking,updated_by=excluded.updated_by,updated_at=now();
 end if;
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,s.organization_id,'DRIVER_ACCESS_UPDATED','profile',target_driver,
  jsonb_build_object('driver_user_id',target_driver,'vehicle_id',target_vehicle,'can_manage_capacity',cap,'can_manage_tracking',tracking,
   'displaced_assignment_count',displaced,'providerProfileId',s.provider_profile_id));
 return jsonb_build_object('driver_user_id',target_driver,'vehicle_id',target_vehicle,'can_manage_capacity',cap,'can_manage_tracking',tracking);
end $$;

create function public.fleet_driver_joinable_scope(actor_user_id uuid,target_org uuid,target_provider uuid)
returns boolean language sql stable security definer set search_path=public,auth,pg_temp as $$
 select public.managed_provider_signup_eligible(actor_user_id) or exists(
  select 1 from profiles p join auth.users u on u.id=p.id join drivers d on d.user_id=p.id
  where p.id=actor_user_id and not p.active and p.role='DRIVER' and not d.active and d.offboarded_at is not null
   and d.organization_id is not distinct from target_org and d.provider_profile_id is not distinct from target_provider
   and u.email_confirmed_at is not null and u.deleted_at is null
   and nullif(trim(coalesce(u.raw_app_meta_data->>'role','')),'') is null
   and nullif(trim(coalesce(u.raw_app_meta_data->>'provisioned_by','')),'') is null
   and not exists(select 1 from organization_members where user_id=p.id)
   and not exists(select 1 from provider_profiles where user_id=p.id)
   and not exists(select 1 from support_agent_profiles where user_id=p.id)
   and not exists(select 1 from applications where user_id=p.id));
$$;

create or replace function public.fleet_invite_driver(actor_user_id uuid,command jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare s record;invite_id uuid;email_value text:=lower(trim(coalesce(command->>'email','')));
 name_value text:=trim(coalesce(command->>'name',''));phone_value text:=trim(coalesce(command->>'phone',''));
begin
 select * into s from public.fleet_lock_provider_owner(actor_user_id);
 if email_value!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(email_value)>254
  or char_length(name_value) not between 2 and 100 or char_length(phone_value) not between 7 and 32
  or phone_value!~'^\+?[0-9 ()-]+$' then raise exception 'INVALID_DRIVER_CONTACT';end if;
 if exists(select 1 from drivers d join profiles p on p.id=d.user_id where d.active and lower(p.email)=email_value
  and d.organization_id is not distinct from s.organization_id and d.provider_profile_id is not distinct from s.provider_profile_id)
  then raise exception 'DRIVER_ALREADY_IN_FLEET';end if;
 update fleet_driver_invitations i set cancelled_at=now() where i.organization_id is not distinct from s.organization_id
  and i.provider_profile_id is not distinct from s.provider_profile_id and i.email=email_value
  and i.accepted_at is null and i.cancelled_at is null and i.expires_at<=now();
 select i.id into invite_id from fleet_driver_invitations i where i.organization_id is not distinct from s.organization_id
  and i.provider_profile_id is not distinct from s.provider_profile_id and i.email=email_value and i.accepted_at is null and i.cancelled_at is null;
 if invite_id is not null then return invite_id;end if;
 if(select count(*) from fleet_driver_invitations i where i.organization_id is not distinct from s.organization_id
  and i.provider_profile_id is not distinct from s.provider_profile_id and i.accepted_at is null and i.cancelled_at is null and i.expires_at>now())>=100
  then raise exception 'INVITATION_LIMIT_REACHED';end if;
 insert into fleet_driver_invitations(organization_id,provider_profile_id,email,driver_name,phone,invited_by)
 values(s.organization_id,s.provider_profile_id,email_value,name_value,phone_value,actor_user_id) returning id into invite_id;
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,s.organization_id,'DRIVER_INVITED','driver_invitation',invite_id,jsonb_build_object('providerProfileId',s.provider_profile_id));
 return invite_id;
end $$;

create or replace function public.fleet_pending_invitations(actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare s record;result jsonb;
begin
 select * into s from public.fleet_provider_owner_scope(actor_user_id);
 select coalesce(jsonb_agg(r order by r.created_at desc,r.id),'[]'::jsonb) into result from(
  select i.id,i.email,i.driver_name,i.phone,i.created_at,i.expires_at,i.email_sent_at from fleet_driver_invitations i
  where i.organization_id is not distinct from s.organization_id and i.provider_profile_id is not distinct from s.provider_profile_id
   and i.accepted_at is null and i.cancelled_at is null and i.expires_at>now() order by i.created_at desc,i.id limit 100)r;
 return result;
end $$;

create or replace function public.fleet_identity_invitations(actor_user_id uuid)
returns jsonb language sql stable security definer set search_path=public,auth,pg_temp as $$
 select coalesce(jsonb_agg(r),'[]'::jsonb) from(
 select i.id,coalesce(o.name,public.public_person_first_name(x.user_id)) as organization_name,i.driver_name,i.expires_at,
  public.fleet_driver_joinable_scope(actor_user_id,i.organization_id,i.provider_profile_id) as can_accept
 from fleet_driver_invitations i left join organizations o on o.id=i.organization_id
 left join provider_profiles x on x.id=i.provider_profile_id
 join auth.users u on lower(trim(u.email))=i.email and u.email_confirmed_at is not null
 where u.id=actor_user_id and i.accepted_at is null and i.cancelled_at is null and i.expires_at>now()
 order by i.created_at desc,i.id limit 50)r;
$$;

create or replace function public.fleet_accept_invitation(actor_user_id uuid,invitation_id uuid)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare i fleet_driver_invitations%rowtype;s record;confirmed text;
begin
 select * into i from fleet_driver_invitations where id=invitation_id;
 if not found then raise exception 'INVITATION_NOT_AVAILABLE';end if;
 select * into s from public.fleet_lock_provider_owner(i.invited_by);
 if s.organization_id is distinct from i.organization_id or s.provider_profile_id is distinct from i.provider_profile_id
  then raise exception 'INVITATION_NOT_AVAILABLE';end if;
 perform 1 from profiles where id=actor_user_id for update;
 select lower(trim(email)) into confirmed from auth.users where id=actor_user_id and email_confirmed_at is not null for update;
 select * into i from fleet_driver_invitations where id=invitation_id for update;
 if confirmed is null or confirmed<>i.email or i.cancelled_at is not null then raise exception 'INVITATION_NOT_AVAILABLE';end if;
 if i.accepted_by=actor_user_id and i.accepted_at is not null then
  if public.fleet_driver_matches_scope(actor_user_id,s.organization_id,s.provider_profile_id) then return coalesce(s.organization_id,s.provider_profile_id);end if;
  raise exception 'INVITATION_NOT_AVAILABLE';
 end if;
 if i.accepted_at is not null or i.expires_at<=now() then raise exception 'INVITATION_NOT_AVAILABLE';end if;
 if not public.fleet_driver_joinable_scope(actor_user_id,s.organization_id,s.provider_profile_id) then raise exception 'DRIVER_ACCOUNT_CONFLICT';end if;
 update profiles set active=true,full_name=i.driver_name,phone=i.phone,public_callback_phone=i.phone,public_callback_phone_configured=true where id=actor_user_id;
 if s.organization_id is not null then insert into organization_members(user_id,organization_id,membership_role) values(actor_user_id,s.organization_id,'DRIVER');end if;
 insert into drivers(organization_id,provider_profile_id,user_id,name,phone,active) values(s.organization_id,s.provider_profile_id,actor_user_id,i.driver_name,i.phone,true)
  on conflict(user_id) do update set name=excluded.name,phone=excluded.phone,active=true,offboarded_at=null;
 insert into driver_permissions(user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,can_manage_capacity,can_manage_tracking,updated_by)
 values(actor_user_id,false,false,false,false,false,i.invited_by) on conflict(user_id) do update set can_browse_load_board=false,can_contact_businesses=false,
  can_negotiate_loads=false,can_manage_capacity=false,can_manage_tracking=false,updated_by=excluded.updated_by,updated_at=now();
 update fleet_driver_invitations set accepted_at=now(),accepted_by=actor_user_id where id=i.id;
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,s.organization_id,'DRIVER_INVITATION_ACCEPTED','driver_invitation',i.id,jsonb_build_object('providerProfileId',s.provider_profile_id));
 return coalesce(s.organization_id,s.provider_profile_id);
end $$;

create or replace function public.fleet_cancel_invitation(actor_user_id uuid,invitation_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare s record;
begin
 select * into s from public.fleet_lock_provider_owner(actor_user_id);
 update fleet_driver_invitations i set cancelled_at=now(),email_lease=null where i.id=invitation_id
  and i.organization_id is not distinct from s.organization_id and i.provider_profile_id is not distinct from s.provider_profile_id
  and i.accepted_at is null and i.cancelled_at is null;
 if not found then raise exception 'INVITATION_NOT_AVAILABLE';end if;
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,s.organization_id,'DRIVER_INVITATION_CANCELLED','driver_invitation',invitation_id,jsonb_build_object('providerProfileId',s.provider_profile_id));
 return true;
end $$;

create or replace function public.fleet_claim_invitation_email(actor_user_id uuid,invitation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s record;i fleet_driver_invitations%rowtype;
begin
 select * into s from public.fleet_lock_provider_owner(actor_user_id);
 update fleet_driver_invitations invitation set email_lease=gen_random_uuid(),email_attempted_at=now()
 where invitation.id=invitation_id and invitation.organization_id is not distinct from s.organization_id
  and invitation.provider_profile_id is not distinct from s.provider_profile_id and invitation.accepted_at is null
  and invitation.cancelled_at is null and invitation.expires_at>now()
  and(invitation.email_attempted_at is null or invitation.email_attempted_at<now()-interval '1 minute') returning * into i;
 if not found then return null;end if;
 return jsonb_build_object('id',i.id,'email',i.email,'lease',i.email_lease,'organization_name',coalesce(
  (select name from organizations where id=s.organization_id),public.public_person_first_name(actor_user_id)));
end $$;

create or replace function public.fleet_driver_registration_target(actor_user_id uuid,command jsonb)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare s record;target_id uuid;email_value text:=lower(trim(coalesce(command->>'email','')));
 name_value text:=trim(coalesce(command->>'name',''));phone_value text:=trim(coalesce(command->>'phone',''));
begin
 select * into s from public.fleet_lock_provider_owner(actor_user_id);
 if email_value!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(email_value)>254
  or char_length(name_value) not between 2 and 100 or char_length(phone_value) not between 7 and 32
  or phone_value!~'^\+?[0-9 ()-]+$' then raise exception 'INVALID_DRIVER_CONTACT';end if;
 select id into target_id from auth.users where lower(trim(email))=email_value;
 if target_id is not null then
  perform 1 from profiles where id=target_id for update;perform 1 from auth.users where id=target_id for update;
  if exists(select 1 from drivers d join profiles p on p.id=d.user_id and p.active and p.role='DRIVER'
   where d.user_id=target_id and d.active and d.organization_id is not distinct from s.organization_id
    and d.provider_profile_id is not distinct from s.provider_profile_id and public.fleet_driver_matches_scope(p.id,s.organization_id,s.provider_profile_id)) then return target_id;end if;
  if not exists(select 1 from profiles p join auth.users u on u.id=p.id where p.id=target_id and not p.active and p.role='DRIVER'
   and u.deleted_at is null and not coalesce(u.is_anonymous,false) and(u.banned_until is null or u.banned_until<=now())
   and nullif(trim(coalesce(u.raw_app_meta_data->>'role','')),'') is null and nullif(trim(coalesce(u.raw_app_meta_data->>'provisioned_by','')),'') is null
   and not exists(select 1 from applications where user_id=p.id) and not exists(select 1 from provider_profiles where user_id=p.id)
   and not exists(select 1 from organization_members where user_id=p.id) and not exists(select 1 from drivers where user_id=p.id)
   and not exists(select 1 from driver_permissions where user_id=p.id) and not exists(select 1 from driver_vehicle_assignments where driver_user_id=p.id)
   and not exists(select 1 from support_agent_profiles where user_id=p.id)) then raise exception 'DRIVER_ACCOUNT_CONFLICT';end if;
 end if;
 if(select count(*) from drivers d join auth.users u on u.id=d.user_id where d.active and u.email_confirmed_at is null
  and d.organization_id is not distinct from s.organization_id and d.provider_profile_id is not distinct from s.provider_profile_id)>=100
  then raise exception 'INVITATION_LIMIT_REACHED';end if;
 return target_id;
end $$;

create or replace function public.fleet_register_driver(actor_user_id uuid,target_user_id uuid,command jsonb)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare s record;resolved uuid;email_value text:=lower(trim(coalesce(command->>'email','')));
 name_value text:=trim(coalesce(command->>'name',''));phone_value text:=trim(coalesce(command->>'phone',''));
begin
 select * into s from public.fleet_lock_provider_owner(actor_user_id);
 resolved:=public.fleet_driver_registration_target(actor_user_id,command);
 if resolved is null or resolved is distinct from target_user_id or not exists(select 1 from auth.users where id=target_user_id and lower(trim(email))=email_value)
  then raise exception 'DRIVER_ACCOUNT_CONFLICT';end if;
 if exists(select 1 from drivers d where d.user_id=target_user_id and d.active and d.organization_id is not distinct from s.organization_id
  and d.provider_profile_id is not distinct from s.provider_profile_id) then return target_user_id;end if;
 update profiles set active=true,full_name=name_value,public_callback_phone=phone_value,public_callback_phone_configured=true where id=target_user_id;
 if s.organization_id is not null then insert into organization_members(user_id,organization_id,membership_role) values(target_user_id,s.organization_id,'DRIVER');end if;
 insert into drivers(organization_id,provider_profile_id,user_id,name,phone,active) values(s.organization_id,s.provider_profile_id,target_user_id,name_value,phone_value,true);
 insert into driver_permissions(user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,can_manage_capacity,can_manage_tracking,updated_by)
 values(target_user_id,false,false,false,false,false,actor_user_id);
 update fleet_driver_invitations i set cancelled_at=now(),email_lease=null where i.organization_id is not distinct from s.organization_id
  and i.provider_profile_id is not distinct from s.provider_profile_id and i.email=email_value and i.accepted_at is null and i.cancelled_at is null;
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,s.organization_id,'DRIVER_ADDED','profile',target_user_id,jsonb_build_object('providerProfileId',s.provider_profile_id));
 return target_user_id;
end $$;

create or replace function public.fleet_update_driver_contact(actor_user_id uuid,command jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare s record;driver_id uuid:=(command->>'driver_user_id')::uuid;
 name_value text:=trim(coalesce(command->>'name',''));phone_value text:=trim(coalesce(command->>'phone',''));
begin
 select * into s from public.fleet_lock_provider_owner(actor_user_id);
 if driver_id=actor_user_id then raise exception 'FORBIDDEN';end if;
 if char_length(name_value) not between 2 and 100 or char_length(phone_value) not between 7 and 32
  or phone_value!~'^\+?[0-9 ()-]+$' then raise exception 'INVALID_DRIVER_CONTACT';end if;
 perform 1 from drivers d where d.user_id=driver_id and d.active and d.organization_id is not distinct from s.organization_id
  and d.provider_profile_id is not distinct from s.provider_profile_id for update;
 if not found or not public.fleet_driver_matches_scope(driver_id,s.organization_id,s.provider_profile_id) then raise exception 'NOT_FOUND';end if;
 update drivers set name=name_value,phone=phone_value where user_id=driver_id;
 update profiles set full_name=name_value,first_name=split_part(name_value,' ',1),
  last_name=nullif(trim(substr(name_value,length(split_part(name_value,' ',1))+1)),''),
  public_callback_phone=phone_value,public_callback_phone_configured=true where id=driver_id;
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,s.organization_id,'DRIVER_CONTACT_UPDATED','driver',driver_id,jsonb_build_object('providerProfileId',s.provider_profile_id));
 return true;
end $$;

create or replace function public.fleet_remove_driver(actor_user_id uuid,driver_user_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare s record;d drivers%rowtype;
begin
 select * into s from public.fleet_lock_provider_owner(actor_user_id);
 if driver_user_id=actor_user_id or exists(select 1 from provider_profiles where user_id=driver_user_id)
  or exists(select 1 from organization_members where user_id=driver_user_id and membership_role='OWNER') then raise exception 'DRIVER_ACCOUNT_CONFLICT';end if;
 select * into d from drivers employee where employee.user_id=driver_user_id and employee.organization_id is not distinct from s.organization_id
  and employee.provider_profile_id is not distinct from s.provider_profile_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if not d.active and d.offboarded_at is not null then return true;end if;
 if exists(select 1 from provider_shipments shipment where shipment.assigned_driver_user_id=driver_user_id
  and shipment.operational_status not in('COMPLETED','CANCELLED')) then raise exception 'TRUCK_HAS_ACTIVE_TRACKING';end if;
 update driver_vehicle_assignments a set active=false where a.driver_user_id=fleet_remove_driver.driver_user_id and a.active;
 update driver_permissions p set can_manage_capacity=false,can_manage_tracking=false,can_browse_load_board=false,can_contact_businesses=false,
  can_negotiate_loads=false,updated_by=actor_user_id,updated_at=now() where p.user_id=driver_user_id;
 delete from organization_members m where m.user_id=driver_user_id and m.organization_id=s.organization_id and m.membership_role='DRIVER';
 update drivers set active=false,offboarded_at=now() where id=d.id;
 update profiles set active=false where id=driver_user_id and role='DRIVER';
 insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,s.organization_id,'DRIVER_REMOVED_FROM_FLEET','driver',driver_user_id,jsonb_build_object('providerProfileId',s.provider_profile_id));
 return true;
end $$;

-- Preserve the current reviewed implementations, including private sharing,
-- location offsets, proofs and Tracking route wrappers. Refuse source drift.
do $migration$
declare signature text;original text;patched text;old_text text;new_text text;expected_count integer;
begin
 signature:='public.create_provider_vehicle(uuid,jsonb)';original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc') from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
 old_text:=$before$  use_basis_value:=nullif(command->>'use_basis','');
  if use_basis_value is not null and use_basis_value not in ('OWNED','PERMISSION') then raise exception 'INVALID_VEHICLE_USE_BASIS';end if;
  if actor.actor_role='DRIVER' then
    -- Serialize initial additions and replacements for this exact provider.
    perform 1 from public.provider_profiles where id=actor.provider_profile_id and user_id=actor_user_id for update;
    if not found then raise exception 'FORBIDDEN';end if;
    if use_basis_value is null then raise exception 'INVALID_VEHICLE_USE_BASIS';end if;
    begin requested_replacement:=nullif(command->>'replace_vehicle_id','')::uuid;
    exception when others then raise exception 'NOT_FOUND';end;
    select id into current_vehicle_id from public.vehicles where provider_profile_id=actor.provider_profile_id and active for update;
    if requested_replacement is null then
      if current_vehicle_id is not null then raise exception 'SINGLE_TRUCK_LIMIT';end if;
    else
      if current_vehicle_id is distinct from requested_replacement then raise exception 'TRUCK_CHANGED';end if;
      if command->>'replacement_confirmed' is distinct from 'true' then raise exception 'TRUCK_CHANGE_CONFIRMATION_REQUIRED';end if;
      -- Raises on unfinished Tracking; all later validation errors roll back this retirement.
      perform public.set_vehicle_lifecycle(actor_user_id,current_vehicle_id,false,'Changed the truck I drive');
    end if;
  elsif nullif(command->>'replace_vehicle_id','') is not null then
    raise exception 'FORBIDDEN';
  end if;
$before$;new_text:=$after$  perform public.fleet_lock_provider_owner(actor_user_id);
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  use_basis_value:=nullif(command->>'use_basis','');
  if use_basis_value is null or use_basis_value not in ('OWNED','FINANCED','PERMISSION') then raise exception 'INVALID_VEHICLE_USE_BASIS';end if;
  if nullif(command->>'replace_vehicle_id','') is not null then raise exception 'TRUCK_CHANGE_REQUIRED';end if;
$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 old_text:=$before$'supported_trailer_configurations',supported_value,'active',true$before$;new_text:=$after$'supported_trailer_configurations',supported_value,'active',true,'publication_status','DRAFT'$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 execute patched;
 signature:='public.update_provider_vehicle_details(uuid,jsonb)';original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc') from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
 old_text:=$before$  if actor.actor_role='TRANSPORTER' then perform public.fleet_owner_organization(actor_user_id); end if;$before$;
 new_text:=$after$  perform public.fleet_lock_provider_owner(actor_user_id);
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 old_text:=$before$  if char_length(make_value) not between 2 and 60 then$before$;
 new_text:=$after$  if (make_value is distinct from vehicle.make or model_value is distinct from vehicle.model or plate_value is distinct from vehicle.plate
    or (not vehicle.trailer_interchangeable and config is distinct from vehicle.cargo_configuration))
    and exists(select 1 from provider_shipments where assigned_vehicle_id=vehicle.id and operational_status not in ('COMPLETED','CANCELLED'))
    then raise exception 'TRUCK_HAS_ACTIVE_TRACKING';end if;
  if char_length(make_value) not between 2 and 60 then$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 old_text:=$before$  if actor.actor_role='DRIVER' then
    if nullif(command->>'use_basis','') is null or command->>'use_basis' not in ('OWNED','PERMISSION') then raise exception 'INVALID_VEHICLE_USE_BASIS';end if;
    if make_value is distinct from vehicle.make or model_value is distinct from vehicle.model
      or plate_value is distinct from vehicle.plate or (not vehicle.trailer_interchangeable and config is distinct from vehicle.cargo_configuration)
      then raise exception 'TRUCK_CHANGE_REQUIRED';end if;
  end if;
$before$;new_text:=$after$  if nullif(command->>'use_basis','') is null or command->>'use_basis' not in ('OWNED','FINANCED','PERMISSION') then raise exception 'INVALID_VEHICLE_USE_BASIS';end if;
$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 old_text:=$before$  if actor.actor_role='DRIVER' then update public.vehicles set use_basis=command->>'use_basis' where id=vehicle.id;end if;$before$;new_text:=$after$  update public.vehicles set use_basis=command->>'use_basis' where id=vehicle.id;$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 execute patched;
 signature:='public.set_vehicle_lifecycle(uuid,uuid,boolean,text)';original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc') from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
 old_text:=$before$ if desired_active and vehicle.provider_profile_id is not null and not vehicle.active then
   if exists(select 1 from public.profiles where id=actor_user_id and role='DRIVER') then raise exception 'TRUCK_CHANGE_REQUIRED';end if;
   if exists(select 1 from public.vehicles where provider_profile_id=vehicle.provider_profile_id and active and id<>vehicle.id) then raise exception 'SINGLE_TRUCK_LIMIT';end if;
 end if;
$before$;new_text:=$after$$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 execute patched;
 signature:='public.provider_capacity_workspace(uuid)';original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc') from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
 old_text:=$before$where vehicle.active and (
      actor.actor_role='TRANSPORTER' and vehicle.organization_id=actor.organization_id
      or actor.actor_role='DRIVER' and actor.provider_profile_id is not null
        and vehicle.provider_profile_id=actor.provider_profile_id
      or actor.is_company_driver and vehicle.organization_id=actor.organization_id and exists(
        select 1 from public.driver_vehicle_assignments assignment
        where assignment.driver_user_id=actor_user_id
          and assignment.vehicle_id=vehicle.id and assignment.active
      )
    )$before$;new_text:=$after$where vehicle.active and public.fleet_actor_can_use_vehicle(actor_user_id,vehicle.id)$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>2 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 old_text:=$before$where (route.organization_id=actor.organization_id or route.provider_profile_id=actor.provider_profile_id)
    and route.assigned_vehicle_id is not null
    and route.assigned_driver_user_id=public.capacity_active_driver_id(route.assigned_vehicle_id)
    and exists(select 1 from public.vehicles v where v.id=route.assigned_vehicle_id and v.active
      and (actor.actor_role='TRANSPORTER' and v.organization_id=actor.organization_id
        or actor.provider_profile_id is not null and v.provider_profile_id=actor.provider_profile_id
        or actor.is_company_driver and route.assigned_driver_user_id=actor_user_id));$before$;new_text:=$after$where route.assigned_vehicle_id is not null
    and route.assigned_driver_user_id=public.capacity_active_driver_id(route.assigned_vehicle_id)
    and public.fleet_actor_can_use_vehicle(actor_user_id,route.assigned_vehicle_id);$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 old_text:=$before$'platform_number',vehicle.platform_number,'active',vehicle.active,$before$;new_text:=$after$'platform_number',vehicle.platform_number,'active',vehicle.active,'publication_status',vehicle.publication_status,$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 execute patched;
 signature:='public.provider_tracking_workspace(uuid,integer)';original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc') from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
 old_text:=$before$where vehicle.active and (
      actor.actor_role='TRANSPORTER' and vehicle.organization_id=actor.organization_id
      or actor.actor_role='DRIVER' and actor.provider_profile_id is not null
        and vehicle.provider_profile_id=actor.provider_profile_id
      or actor.is_company_driver and vehicle.organization_id=actor.organization_id and exists(
        select 1 from public.driver_vehicle_assignments assignment
        where assignment.driver_user_id=actor_user_id
          and assignment.vehicle_id=vehicle.id and assignment.active
      )
    )$before$;new_text:=$after$where vehicle.active and public.fleet_actor_can_use_vehicle(actor_user_id,vehicle.id)$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 execute patched;
 signature:='public.publish_provider_capacity(uuid,jsonb)';original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc') from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
 old_text:=$before$and candidate.active and (
    actor.actor_role='TRANSPORTER' and candidate.organization_id=actor.organization_id
    or actor.actor_role='DRIVER' and actor.provider_profile_id is not null
      and candidate.provider_profile_id=actor.provider_profile_id
    or actor.is_company_driver and candidate.organization_id=actor.organization_id and exists(
      select 1 from public.driver_vehicle_assignments assignment
      where assignment.driver_user_id=actor_user_id and assignment.vehicle_id=candidate.id and assignment.active
    )
  ) for update of candidate;$before$;new_text:=$after$and candidate.active and public.fleet_actor_can_use_vehicle(actor_user_id,candidate.id) for update of candidate;$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 old_text:=$before$if actor.actor_role='DRIVER' and coalesce(command->>'location_source','')<>'PRESERVE_DRIVER' then$before$;new_text:=$after$if assigned_driver=actor_user_id and coalesce(command->>'location_source','')<>'PRESERVE_DRIVER' then$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 execute patched;
 signature:='public.refresh_provider_capacity_location(uuid,jsonb)';original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc') from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
 old_text:=$before$and candidate.active and (
    actor.provider_profile_id is not null and candidate.provider_profile_id=actor.provider_profile_id
    or actor.is_company_driver and candidate.organization_id=actor.organization_id and exists(
      select 1 from public.driver_vehicle_assignments assignment
      where assignment.driver_user_id=actor_user_id and assignment.vehicle_id=candidate.id and assignment.active
    )
  ) for update of candidate;$before$;new_text:=$after$and candidate.active and public.fleet_actor_can_use_vehicle(actor_user_id,candidate.id) for update of candidate;$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 old_text:=$before$if not found or actor.actor_role<>'DRIVER' then raise exception 'DEVICE_LOCATION_DRIVER_ONLY'; end if;$before$;new_text:=$after$if not found then raise exception 'DEVICE_LOCATION_DRIVER_ONLY'; end if;$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 execute patched;
 signature:='public.set_provider_assigned_vehicle_duty(uuid,jsonb)';original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc') from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
 old_text:=$before$if not found or not actor.is_company_driver then raise exception 'FORBIDDEN'; end if;$before$;new_text:=$after$if not found then raise exception 'FORBIDDEN';end if;$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 old_text:=$before$and candidate.organization_id=actor.organization_id and candidate.active$before$;new_text:=$after$and public.fleet_actor_can_use_vehicle(actor_user_id,candidate.id) and candidate.active$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 execute patched;
 signature:='public.create_provider_tracking_pre_route_map(uuid,jsonb)';original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc') from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
 old_text:=$before$if not found or not (
    actor.actor_role='TRANSPORTER' and vehicle.organization_id=actor.organization_id
    or actor.actor_role='DRIVER' and actor.provider_profile_id is not null
      and vehicle.provider_profile_id=actor.provider_profile_id
    or actor.is_company_driver and vehicle.organization_id=actor.organization_id and exists(
      select 1 from public.driver_vehicle_assignments assignment
      where assignment.vehicle_id=vehicle.id and assignment.driver_user_id=actor_user_id and assignment.active
    )
  ) then raise exception 'INVALID_VEHICLE'; end if;$before$;new_text:=$after$if not found or not public.fleet_actor_can_use_vehicle(actor_user_id,vehicle.id) then raise exception 'INVALID_VEHICLE';end if;$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 old_text:=$before$  if vehicle.provider_profile_id is not null then
    assigned_driver_id:=actor_user_id;
  else
    select assignment.driver_user_id into assigned_driver_id
    from public.driver_vehicle_assignments assignment
    where assignment.vehicle_id=vehicle.id and assignment.active
    order by assignment.assigned_at desc,assignment.id
    limit 1;
  end if;$before$;new_text:=$after$  assigned_driver_id:=public.capacity_active_driver_id(vehicle.id);$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 execute patched;
 signature:='public.update_provider_tracking_status(uuid,uuid,jsonb)';original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc') from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
 old_text:=$before$actor.role::text='DRIVER'$before$;new_text:=$after$(actor.role::text='DRIVER' or actor.role::text='TRANSPORTER' and actor.drives_truck)$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 execute patched;
 signature:='public.assigned_location_tracking(uuid)';original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc') from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
 old_text:=$before$p.active and p.role='DRIVER'$before$;new_text:=$after$p.active and (p.role='DRIVER' or p.role='TRANSPORTER' and p.drives_truck)$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 execute patched;
 signature:='public.issue_tracking_device_lease(uuid,uuid,uuid,text,integer)';original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc') from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
 old_text:=$before$active and role='DRIVER'$before$;new_text:=$after$active and (role='DRIVER' or role='TRANSPORTER' and drives_truck)$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 execute patched;
 signature:='public.report_tracking_device_location(text,jsonb)';original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc') from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
 old_text:=$before$active and role='DRIVER'$before$;new_text:=$after$active and (role='DRIVER' or role='TRANSPORTER' and drives_truck)$after$;
 if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_FLEET_PATCH_DRIFT: %',signature;end if;
 patched:=replace(patched,old_text,new_text);
 execute patched;
end $migration$;

-- Reuse current locked authority and actual write time after any lock wait.
-- Pair-specific device fixes and duty setup cannot cross an assignment change.
do $migration$
declare signature text;definition text;old_text text;new_text text;stamp_text text;
begin
 foreach signature in array array['public.publish_provider_capacity(uuid,jsonb)',
  'public.refresh_provider_capacity_location(uuid,jsonb)','public.set_provider_assigned_vehicle_duty(uuid,jsonb)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  old_text:=$before$  if not found then raise exception 'INVALID_VEHICLE'; end if;$before$;
  stamp_text:='  timestamp_value:=public.provider_capacity_write_timestamp(vehicle.id);';
  if signature like '%refresh_provider%' then
   stamp_text:=$after$  timestamp_value:=greatest(public.provider_capacity_write_timestamp(vehicle.id),
    coalesce((select max(report.updated_at)+interval '1 microsecond' from vehicle_driver_locations report where report.vehicle_id=vehicle.id),'-infinity'::timestamptz),
    coalesce((select max(c.location_updated_at)+interval '1 microsecond' from capacities c where c.vehicle_id=vehicle.id),'-infinity'::timestamptz));$after$;
  end if;
  new_text:=old_text||E'\n  select * into actor from public.provider_capacity_actor_scope(actor_user_id);\n  if not found or not actor.workspace_access or not public.fleet_actor_can_use_vehicle(actor_user_id,vehicle.id) then raise exception ''INVALID_VEHICLE'';end if;\n';
  if signature like '%publish_provider%' then
   new_text:=new_text||E'  if actor.is_company_driver and not actor.can_manage_capacity then raise exception ''FORBIDDEN'';end if;\n';
  end if;
  new_text:=new_text||stamp_text;
  if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_CAPACITY_WRITE_LOCK_DRIFT';end if;
  execute replace(definition,old_text,new_text);
 end loop;
 signature:='public.set_vehicle_lifecycle(uuid,uuid,boolean,text)';definition:=pg_get_functiondef(signature::regprocedure);
 old_text:=$before$ if vehicle.active=desired_active then$before$;
 if strpos(definition,old_text)=0 then raise exception 'PROVIDER_LIFECYCLE_STAMP_DRIFT';end if;
 execute replace(definition,old_text,E' stamp:=public.provider_capacity_write_timestamp(vehicle.id);\n'||old_text);

 signature:='public.provider_capacity_workspace(uuid)';definition:=pg_get_functiondef(signature::regprocedure);
 old_text:='report.driver_user_id=public.capacity_active_driver_id(vehicle.id)';
 if(length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'PROVIDER_CURRENT_FIX_DRIFT';end if;
 definition:=replace(definition,old_text,old_text||' and report.updated_at>=public.provider_capacity_pair_started_at(vehicle.id)');
 old_text:=$before$join public.profiles publisher on publisher.id=saved.updated_by and publisher.role='TRANSPORTER' where saved.vehicle_id=vehicle.id$before$;
 new_text:=$after$join public.profiles publisher on publisher.id=saved.updated_by where saved.vehicle_id=vehicle.id
       and saved.updated_at>=public.provider_capacity_pair_started_at(vehicle.id)
       and (public.fleet_actor_can_use_vehicle(publisher.id,vehicle.id,true) or publisher.id=public.capacity_active_driver_id(vehicle.id))$after$;
 if strpos(definition,old_text)=0 then raise exception 'PROVIDER_CURRENT_DUTY_SETUP_DRIFT';end if;
 execute replace(definition,old_text,new_text);

 signature:='public.publish_provider_capacity(uuid,jsonb)';definition:=pg_get_functiondef(signature::regprocedure);
 old_text:='report.driver_user_id=assigned_driver';new_text:=old_text||' and report.updated_at>=public.provider_capacity_pair_started_at(vehicle.id)';
 if strpos(definition,old_text)=0 then raise exception 'PROVIDER_PRESERVED_FIX_DRIFT';end if;
 definition:=replace(definition,old_text,new_text);
 old_text:='capacity.updated_by=assigned_driver';new_text:=old_text||' and capacity.location_updated_at>=public.provider_capacity_pair_started_at(vehicle.id)';
 if strpos(definition,old_text)=0 then raise exception 'PROVIDER_PRESERVED_CAPACITY_FIX_DRIFT';end if;
 execute replace(definition,old_text,new_text);

 signature:='public.set_provider_assigned_vehicle_duty(uuid,jsonb)';definition:=pg_get_functiondef(signature::regprocedure);
 old_text:=$before$join public.profiles publisher on publisher.id=candidate.updated_by and publisher.role='TRANSPORTER'
    where candidate.vehicle_id=vehicle.id$before$;
 new_text:=$after$join public.profiles publisher on publisher.id=candidate.updated_by
    where candidate.vehicle_id=vehicle.id and candidate.updated_at>=public.provider_capacity_pair_started_at(vehicle.id)
      and (public.fleet_actor_can_use_vehicle(publisher.id,vehicle.id,true) or publisher.id=actor_user_id)$after$;
 if strpos(definition,old_text)=0 then raise exception 'PROVIDER_DUTY_PAIR_SETUP_DRIFT';end if;
 execute replace(definition,old_text,new_text);
end $migration$;

create or replace function public.provider_tracking_actor_owns_shipment(actor_user_id uuid,target_shipment_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.provider_tracking_actor_scope(actor_user_id) a
 join public.provider_shipments s on s.id=target_shipment_id
 join public.profiles p on p.id=actor_user_id and p.active
 where a.can_manage_tracking and(a.workspace_access or s.operational_status not in('COMPLETED','CANCELLED')) and(
  p.role='TRANSPORTER' and s.provider_organization_id is not null and exists(select 1 from organization_members m
   where m.user_id=p.id and m.organization_id=s.provider_organization_id and m.membership_role='OWNER')
  or p.role='DRIVER' and s.provider_profile_id is not null and exists(select 1 from provider_profiles x
   where x.id=s.provider_profile_id and x.user_id=p.id)
  or a.is_company_driver and s.assigned_driver_user_id=p.id
   and public.fleet_driver_matches_scope(p.id,s.provider_organization_id,s.provider_profile_id)
   and exists(select 1 from driver_vehicle_assignments assignment where assignment.driver_user_id=p.id
    and assignment.vehicle_id=s.assigned_vehicle_id and assignment.active)));
$$;

-- Preserve the caller-bound verified-email projection intact, merging only
-- server-computed capabilities. The retained base has no browser/service grant.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.current_user_projection()'::regprocedure);
 if to_regprocedure('public.current_user_projection_pre_provider_fleet145()') is not null
  or strpos(definition,'profile.id=auth.uid()')=0 or strpos(definition,'identity.email_confirmed_at is not null')=0
  then raise exception 'PROVIDER_IDENTITY_PROJECTION_DRIFT';end if;
 execute replace(definition,'FUNCTION public.current_user_projection(', 'FUNCTION public.current_user_projection_pre_provider_fleet145(');
 revoke all on function public.current_user_projection_pre_provider_fleet145() from public,anon,authenticated,service_role;
end $migration$;
create or replace function public.current_user_projection()
returns jsonb language sql stable security definer set search_path=public,auth,pg_temp as $$
 select public.current_user_projection_pre_provider_fleet145() || public.provider_account_capabilities(auth.uid());
$$;

create function public.validate_current_provider_driver_assignment()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v vehicles%rowtype;
begin
 if new.active then
  select * into v from vehicles where id=new.vehicle_id and active;
  if not found or not public.fleet_driver_matches_scope(new.driver_user_id,v.organization_id,v.provider_profile_id)
   then raise exception 'INVALID_DRIVER_ACCESS';end if;
 end if;
 return new;
end $$;
create trigger validate_current_provider_driver_assignment before insert or update of active,driver_user_id,vehicle_id
on public.driver_vehicle_assignments for each row execute function public.validate_current_provider_driver_assignment();

-- Actor-id helpers remain server-only. Existing function ACLs are retained by
-- CREATE OR REPLACE; new helpers never become alternate browser endpoints.
do $migration$
declare signature text;
begin
 foreach signature in array array[
  'fleet_provider_owner_scope(uuid)','fleet_lock_provider_owner(uuid)',
  'fleet_driver_matches_scope(uuid,uuid,uuid)','fleet_actor_can_use_vehicle(uuid,uuid,boolean)',
  'fleet_driver_joinable_scope(uuid,uuid,uuid)','provider_account_capabilities(uuid)',
  'provider_capacity_write_timestamp(uuid)','provider_capacity_pair_started_at(uuid)',
  'validate_current_provider_driver_assignment()'
 ] loop
  execute format('revoke all on function public.%s from public,anon,authenticated',signature);
  execute format('grant execute on function public.%s to service_role',signature);
 end loop;
end $migration$;

-- Handover notifications follow the actual assigned driver, including a
-- provider owner who personally drives, rather than a legacy role label.
do $migration$
declare signature text;original text;patched text;
begin
 foreach signature in array array['public.driver_handover_alert_snapshot(uuid)',
  'public.acknowledge_driver_handover_alert(uuid,uuid,timestamptz)'] loop
  original:=pg_get_functiondef(signature::regprocedure);
  if(length(original)-length(replace(original,'role=''DRIVER''','')))/length('role=''DRIVER''')<>1
   then raise exception 'PROVIDER_HANDOVER_DRIVER_CONTRACT_DRIFT';end if;
  insert into provider_fleet_145_function_backup select signature,original,p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc')
   from pg_proc p where p.oid=signature::regprocedure on conflict do nothing;
  patched:=replace(original,'role=''DRIVER''','(role=''DRIVER'' or role=''TRANSPORTER'' and drives_truck)');
  execute patched;
 end loop;
end $migration$;

comment on column public.profiles.drives_truck is 'Private provider-owner driving preference; never an employee or ownership grant.';
comment on column public.drivers.provider_profile_id is 'Personal Transport Provider employer; distinct from the driver owning a provider account.';
comment on column public.vehicles.publication_status is 'Owner-selected Draft/Live, separate from retirement, capacity availability and audience. Reviewed eligibility is checked separately.';
notify pgrst,'reload schema';
commit;
