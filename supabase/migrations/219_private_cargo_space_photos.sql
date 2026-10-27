-- FEAT-CSP-001. Cargo-space images are private, assignment-bound observations.
-- This migration intentionally does not alter the installed Capacity search
-- projection; the private-only photo filter is qualified after migration 218.
begin;
select pg_advisory_xact_lock(8030219);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $bucket$
begin
 if not exists(select 1 from storage.buckets where id='capacity-photo' and public=false)
 then raise exception 'CARGO_PHOTO_PRIVATE_BUCKET_REQUIRED';end if;
 if not exists(select 1 from pg_class where oid='storage.objects'::regclass and relrowsecurity)
  or exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
   and permissive='PERMISSIVE')
 then raise exception 'CARGO_PHOTO_STORAGE_POLICY_REVIEW_REQUIRED';end if;
end $bucket$;
-- Storage owns storage.objects; PostgreSQL migrations must not assume that role.
-- Its current RLS has no client policy, so direct reads remain denied. The
-- preflight and SQL regression stop if that boundary changes before rollout.

create table public.cargo_space_photos (
 id uuid primary key default gen_random_uuid(),
 vehicle_id uuid not null references public.vehicles(id),
 uploaded_by uuid not null references public.profiles(id),
 assignment_id uuid not null references public.driver_vehicle_assignments(id),
 assignment_assigned_at timestamptz not null,
 storage_path text not null unique check(storage_path ~
  '^supabase://capacity-photo/capacity/[0-9]{4}-[0-9]{2}-[0-9]{2}/[a-f0-9-]{36}\.jpg$'),
 source text not null check(source in('CAMERA','UPLOAD')),
 camera_captured_at timestamptz,
 byte_size integer not null check(byte_size between 1 and 4194304),
 state text not null default 'PENDING' check(state in('PENDING','ACTIVE','DELETING','DELETED')),
 created_at timestamptz not null default clock_timestamp(),
 received_at timestamptz,
 removed_at timestamptz,
 cleanup_after timestamptz not null default clock_timestamp(),
 check((state='ACTIVE')=(received_at is not null and removed_at is null)),
 check(source='CAMERA' or camera_captured_at is null)
);
create unique index cargo_space_photo_current on public.cargo_space_photos(vehicle_id)
 where state='ACTIVE';
create index cargo_space_photo_cleanup on public.cargo_space_photos(state,created_at)
 where state in('PENDING','DELETING');
create index cargo_space_photo_cleanup_due on public.cargo_space_photos(cleanup_after,id)
 where state='DELETING';
alter table public.cargo_space_photos enable row level security;
revoke all on public.cargo_space_photos from public,anon,authenticated;
grant select,insert,update,delete on public.cargo_space_photos to service_role;

create table public.cargo_space_photo_requests (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.business_workspaces(id),
 vehicle_id uuid not null references public.vehicles(id),
 requested_by uuid not null references public.profiles(id),
 idempotency_key uuid not null,
 status text not null default 'PENDING' check(status in('PENDING','FULFILLED')),
 created_at timestamptz not null default clock_timestamp(),
 fulfilled_at timestamptz,
 fulfilled_photo_id uuid references public.cargo_space_photos(id),
 unique(workspace_id,requested_by,idempotency_key),
 check((status='FULFILLED')=(fulfilled_at is not null and fulfilled_photo_id is not null))
);
create unique index cargo_space_photo_request_pending on public.cargo_space_photo_requests(workspace_id,vehicle_id)
 where status='PENDING';
create index cargo_space_photo_request_vehicle on public.cargo_space_photo_requests(vehicle_id,created_at desc);
alter table public.cargo_space_photo_requests enable row level security;
revoke all on public.cargo_space_photo_requests from public,anon,authenticated;
grant select,insert,update on public.cargo_space_photo_requests to service_role;

-- Moving, disabling, or replacing an assignment permanently retires its old
-- observation, even if a later edit moves the same assignment row back.
create function public.cargo_photo_assignment_invalidate()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if tg_op='UPDATE' then
  if old.vehicle_id is not distinct from new.vehicle_id
   and old.driver_user_id is not distinct from new.driver_user_id
   and old.active is not distinct from new.active
   and old.assigned_at is not distinct from new.assigned_at then return null;end if;
 end if;
 update public.cargo_space_photos p set state='DELETING',removed_at=clock_timestamp(),
  cleanup_after=clock_timestamp() where p.assignment_id=old.id and p.state in('PENDING','ACTIVE');
 return null;
end $$;
create trigger cargo_photo_assignment_invalidate
after delete or update of vehicle_id,driver_user_id,active,assigned_at
on public.driver_vehicle_assignments for each row
execute function public.cargo_photo_assignment_invalidate();
revoke all on function public.cargo_photo_assignment_invalidate()
 from public,anon,authenticated,service_role;

create function public.cargo_photo_owner_controls_vehicle(actor_user_id uuid,target_vehicle_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select exists(select 1 from public.profiles p join public.vehicles v on v.id=target_vehicle_id and v.active
 where p.id=actor_user_id and p.active and (
  p.role::text='TRANSPORTER' and v.organization_id is not null and exists(
   select 1 from public.organization_members m where m.organization_id=v.organization_id
    and m.user_id=p.id and m.membership_role='OWNER')
  or p.role::text='DRIVER' and v.provider_profile_id is not null and exists(
   select 1 from public.provider_profiles x where x.id=v.provider_profile_id and x.user_id=p.id)))
$$;

create function public.cargo_photo_driver_assignment(actor_user_id uuid,target_vehicle_id uuid)
returns uuid language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select a.id from public.driver_vehicle_assignments a
 join public.profiles p on p.id=a.driver_user_id and p.active and p.role::text='DRIVER'
 left join public.drivers d on d.user_id=p.id
 join public.vehicles v on v.id=a.vehicle_id and v.active
 where a.driver_user_id=actor_user_id and a.vehicle_id=target_vehicle_id and a.active
  and coalesce(d.active,true) limit 1
$$;

create function public.cargo_photo_workspace_granted(target_workspace_id uuid,target_vehicle_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select exists(select 1 from public.business_workspaces w where w.id=target_workspace_id and w.active
  and w.review_workspace=public.business_vehicle_review_scope(target_vehicle_id)
  and public.capacity_sharing_mode(target_vehicle_id) in('PRIVATE','BOTH')
  and (exists(select 1 from public.account_capacity_grants g
    where g.recipient_kind='BUSINESS' and g.recipient_id=w.id and g.vehicle_id=target_vehicle_id
     and public.account_capacity_grant_valid(g.id))
   or exists(select 1 from public.business_capacity_grants g
    where g.workspace_id=w.id and g.vehicle_id=target_vehicle_id and g.revoked_at is null
     and public.private_capacity_actor_controls_vehicle(g.created_by,g.vehicle_id))))
$$;

create function public.cargo_photo_workspace_can_view(actor_user_id uuid,target_workspace_id uuid,target_vehicle_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select public.business_workspace_permission(actor_user_id,target_workspace_id,'CAPACITY')
  and public.cargo_photo_workspace_granted(target_workspace_id,target_vehicle_id)
$$;

create function public.cargo_photo_reserve(actor_user_id uuid,target_vehicle_id uuid,
 target_storage_path text,target_source text,target_camera_captured_at timestamptz,target_byte_size integer)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare assignment public.driver_vehicle_assignments%rowtype;saved_id uuid;
begin
 if target_source not in('CAMERA','UPLOAD') or target_source is null
  or (target_source='UPLOAD' and target_camera_captured_at is not null)
  or target_storage_path is null or target_byte_size is null then raise exception 'CARGO_PHOTO_INVALID';end if;
 select * into assignment from public.driver_vehicle_assignments a
 where a.id=public.cargo_photo_driver_assignment(actor_user_id,target_vehicle_id) for share;
 if not found then raise exception 'CARGO_PHOTO_FORBIDDEN';end if;
 insert into public.cargo_space_photos(vehicle_id,uploaded_by,assignment_id,assignment_assigned_at,
  storage_path,source,camera_captured_at,byte_size)
 values(target_vehicle_id,actor_user_id,assignment.id,assignment.assigned_at,
  target_storage_path,target_source,target_camera_captured_at,target_byte_size) returning id into saved_id;
 return saved_id;
end $$;

create function public.cargo_photo_activate(actor_user_id uuid,target_photo_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare saved public.cargo_space_photos%rowtype;current_assignment public.driver_vehicle_assignments%rowtype;
begin
 select * into saved from public.cargo_space_photos where id=target_photo_id for update;
 if not found or saved.uploaded_by<>actor_user_id then raise exception 'CARGO_PHOTO_FORBIDDEN';end if;
 select * into current_assignment from public.driver_vehicle_assignments a
 where a.id=public.cargo_photo_driver_assignment(actor_user_id,saved.vehicle_id) for share;
 if not found or current_assignment.id<>saved.assignment_id
  or current_assignment.assigned_at<>saved.assignment_assigned_at
 then raise exception 'CARGO_PHOTO_FORBIDDEN';end if;
 if saved.state='ACTIVE' then return jsonb_build_object('id',saved.id,'vehicleId',saved.vehicle_id,
  'receivedAt',saved.received_at,'cameraCapturedAt',saved.camera_captured_at,'source',saved.source);end if;
 if saved.state<>'PENDING' then raise exception 'CARGO_PHOTO_FORBIDDEN';end if;
 perform 1 from public.vehicles where id=saved.vehicle_id and active for update;
 if not found then raise exception 'CARGO_PHOTO_FORBIDDEN';end if;
 update public.cargo_space_photos set state='DELETING',removed_at=clock_timestamp(),cleanup_after=clock_timestamp()
  where vehicle_id=saved.vehicle_id and state='ACTIVE';
 update public.cargo_space_photos set state='ACTIVE',received_at=clock_timestamp()
  where id=saved.id returning * into saved;
 update public.cargo_space_photo_requests set status='FULFILLED',fulfilled_at=saved.received_at,
  fulfilled_photo_id=saved.id where vehicle_id=saved.vehicle_id and status='PENDING'
  and created_at<=saved.received_at;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(actor_user_id,'CARGO_PHOTO_UPLOADED','cargo_space_photo',saved.id,
   jsonb_build_object('vehicleId',saved.vehicle_id,'source',saved.source));
 return jsonb_build_object('id',saved.id,'vehicleId',saved.vehicle_id,
  'receivedAt',saved.received_at,'cameraCapturedAt',saved.camera_captured_at,'source',saved.source);
end $$;

create function public.cargo_photo_mark_delete(actor_user_id uuid,target_photo_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare saved public.cargo_space_photos%rowtype;
begin
 select * into saved from public.cargo_space_photos where id=target_photo_id for update;
 if not found or not public.cargo_photo_owner_controls_vehicle(actor_user_id,saved.vehicle_id)
 then raise exception 'CARGO_PHOTO_FORBIDDEN';end if;
 if saved.state not in('DELETING','DELETED') then
  update public.cargo_space_photos set state='DELETING',removed_at=clock_timestamp(),cleanup_after=clock_timestamp()
   where id=saved.id returning * into saved;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
   values(actor_user_id,'CARGO_PHOTO_REMOVED','cargo_space_photo',saved.id,
    jsonb_build_object('vehicleId',saved.vehicle_id));
 end if;
 return jsonb_build_object('id',saved.id,'vehicleId',saved.vehicle_id,'storagePath',saved.storage_path);
end $$;

create function public.cargo_photo_discard_pending(actor_user_id uuid,target_photo_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare saved public.cargo_space_photos%rowtype;
begin
 select * into saved from public.cargo_space_photos where id=target_photo_id for update;
 if not found or saved.uploaded_by<>actor_user_id or saved.state<>'PENDING' then return null;end if;
 update public.cargo_space_photos set state='DELETING',removed_at=clock_timestamp(),
  cleanup_after=clock_timestamp() where id=saved.id;
 return saved.storage_path;
end $$;

create function public.cargo_photo_cleanup_candidates(requested_limit integer default 10)
returns table(id uuid,storage_path text) language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
begin
 with stale as(select p.id from public.cargo_space_photos p
  where p.state='PENDING' and p.created_at<clock_timestamp()-interval '1 hour'
  order by p.created_at,p.id limit least(20,greatest(1,requested_limit)) for update skip locked)
 update public.cargo_space_photos p set state='DELETING',removed_at=clock_timestamp(),
  cleanup_after=clock_timestamp() from stale where p.id=stale.id;
 return query with due as(select p.id from public.cargo_space_photos p
   where p.state='DELETING' and p.cleanup_after<=clock_timestamp()
   order by p.cleanup_after,p.id limit least(20,greatest(1,requested_limit)) for update skip locked)
  update public.cargo_space_photos p set cleanup_after=clock_timestamp()+interval '5 minutes'
   from due where p.id=due.id returning p.id,p.storage_path;
end $$;

create function public.cargo_photo_provider_state(actor_user_id uuid,target_vehicle_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare owner_access boolean;driver_access boolean;
begin
 owner_access:=public.cargo_photo_owner_controls_vehicle(actor_user_id,target_vehicle_id);
 driver_access:=public.cargo_photo_driver_assignment(actor_user_id,target_vehicle_id) is not null;
 if not owner_access and not driver_access then raise exception 'CARGO_PHOTO_FORBIDDEN';end if;
 return jsonb_build_object('photo',(
  select jsonb_build_object('id',p.id,'vehicleId',p.vehicle_id,'receivedAt',p.received_at,
   'cameraCapturedAt',p.camera_captured_at,'source',p.source)
  from public.cargo_space_photos p join public.driver_vehicle_assignments a on a.id=p.assignment_id and a.vehicle_id=p.vehicle_id
  join public.profiles d on d.id=p.uploaded_by and d.active and d.role::text='DRIVER'
  left join public.drivers driver on driver.user_id=d.id
  where p.vehicle_id=target_vehicle_id and p.state='ACTIVE' and a.active
   and a.driver_user_id=p.uploaded_by and a.assigned_at=p.assignment_assigned_at
   and coalesce(driver.active,true)
 ),'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,
  'workspaceId',r.workspace_id,'requestedAt',r.created_at) order by r.created_at desc)
  from public.cargo_space_photo_requests r where r.vehicle_id=target_vehicle_id and r.status='PENDING'
   and public.cargo_photo_workspace_granted(r.workspace_id,r.vehicle_id)),'[]'::jsonb));
end $$;

create function public.cargo_photo_business_summary(actor_user_id uuid,target_workspace_id uuid,target_vehicle_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if not public.cargo_photo_workspace_can_view(actor_user_id,target_workspace_id,target_vehicle_id)
 then raise exception 'CARGO_PHOTO_FORBIDDEN';end if;
 return jsonb_build_object('photo',(
  select jsonb_build_object('id',p.id,'vehicleId',p.vehicle_id,'receivedAt',p.received_at,
   'cameraCapturedAt',p.camera_captured_at,'source',p.source)
  from public.cargo_space_photos p join public.driver_vehicle_assignments a on a.id=p.assignment_id and a.vehicle_id=p.vehicle_id
  join public.profiles d on d.id=p.uploaded_by and d.active and d.role::text='DRIVER'
  left join public.drivers driver on driver.user_id=d.id
  where p.vehicle_id=target_vehicle_id and p.state='ACTIVE' and a.active
   and a.driver_user_id=p.uploaded_by and a.assigned_at=p.assignment_assigned_at
   and coalesce(driver.active,true)
 ),'request',(
  select jsonb_build_object('id',r.id,'status',r.status,'requestedAt',r.created_at)
  from public.cargo_space_photo_requests r where r.workspace_id=target_workspace_id
   and r.vehicle_id=target_vehicle_id order by r.created_at desc limit 1));
end $$;

create function public.cargo_photo_business_file(actor_user_id uuid,target_workspace_id uuid,target_photo_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare saved record;
begin
 select p.vehicle_id,p.storage_path,p.received_at into saved from public.cargo_space_photos p
  join public.driver_vehicle_assignments a on a.id=p.assignment_id and a.vehicle_id=p.vehicle_id and a.active
  join public.profiles d on d.id=p.uploaded_by and d.active and d.role::text='DRIVER'
  left join public.drivers driver on driver.user_id=d.id
  where p.id=target_photo_id and p.state='ACTIVE' and a.driver_user_id=p.uploaded_by
   and a.assigned_at=p.assignment_assigned_at and coalesce(driver.active,true);
 if not found or not public.cargo_photo_workspace_can_view(actor_user_id,target_workspace_id,saved.vehicle_id)
 then raise exception 'CARGO_PHOTO_NOT_FOUND';end if;
 return jsonb_build_object('storagePath',saved.storage_path,'receivedAt',saved.received_at);
end $$;

create function public.cargo_photo_provider_file(actor_user_id uuid,target_photo_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare saved public.cargo_space_photos%rowtype;
begin
 select * into saved from public.cargo_space_photos where id=target_photo_id and state='ACTIVE';
 if not found or not exists(select 1 from public.driver_vehicle_assignments a
   join public.profiles d on d.id=saved.uploaded_by and d.active and d.role::text='DRIVER'
   left join public.drivers driver on driver.user_id=d.id
   where a.id=saved.assignment_id and a.vehicle_id=saved.vehicle_id and a.active
    and a.driver_user_id=saved.uploaded_by and a.assigned_at=saved.assignment_assigned_at
    and coalesce(driver.active,true))
  or not (public.cargo_photo_owner_controls_vehicle(actor_user_id,saved.vehicle_id)
  or saved.uploaded_by=actor_user_id and
   public.cargo_photo_driver_assignment(actor_user_id,saved.vehicle_id)=saved.assignment_id
   and exists(select 1 from public.driver_vehicle_assignments a where a.id=saved.assignment_id
    and a.assigned_at=saved.assignment_assigned_at))
 then raise exception 'CARGO_PHOTO_NOT_FOUND';end if;
 return jsonb_build_object('storagePath',saved.storage_path,'receivedAt',saved.received_at);
end $$;

create function public.cargo_photo_request(actor_user_id uuid,target_workspace_id uuid,
 target_vehicle_id uuid,target_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare saved public.cargo_space_photo_requests%rowtype;
begin
 if target_idempotency_key is null then raise exception 'CARGO_PHOTO_INVALID';end if;
 if not public.cargo_photo_workspace_can_view(actor_user_id,target_workspace_id,target_vehicle_id)
 then raise exception 'CARGO_PHOTO_FORBIDDEN';end if;
 -- Serialize requests for one vehicle even when several staff act at once.
 perform 1 from public.vehicles where id=target_vehicle_id and active for update;
 if not found or not public.cargo_photo_workspace_can_view(actor_user_id,target_workspace_id,target_vehicle_id)
 then raise exception 'CARGO_PHOTO_FORBIDDEN';end if;
 select * into saved from public.cargo_space_photo_requests
  where workspace_id=target_workspace_id and requested_by=actor_user_id
   and idempotency_key=target_idempotency_key;
 if found then
  if saved.vehicle_id<>target_vehicle_id then raise exception 'CARGO_PHOTO_INVALID';end if;
  return jsonb_build_object('id',saved.id,'status',saved.status,'requestedAt',saved.created_at,'created',false);
 end if;
 select * into saved from public.cargo_space_photo_requests
  where workspace_id=target_workspace_id and vehicle_id=target_vehicle_id and status='PENDING';
 if found then return jsonb_build_object('id',saved.id,'status',saved.status,
  'requestedAt',saved.created_at,'created',false);end if;
 if exists(select 1 from public.cargo_space_photo_requests where workspace_id=target_workspace_id
  and vehicle_id=target_vehicle_id and created_at>clock_timestamp()-interval '6 hours')
 then raise exception 'CARGO_PHOTO_RATE_LIMITED';end if;
 insert into public.cargo_space_photo_requests(workspace_id,vehicle_id,requested_by,idempotency_key)
  values(target_workspace_id,target_vehicle_id,actor_user_id,target_idempotency_key) returning * into saved;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(actor_user_id,'CARGO_PHOTO_REQUEST_CREATED','cargo_space_photo_request',saved.id,
   jsonb_build_object('vehicleId',target_vehicle_id,'workspaceId',target_workspace_id));
 return jsonb_build_object('id',saved.id,'status',saved.status,'requestedAt',saved.created_at,'created',true);
end $$;

revoke all on function public.cargo_photo_owner_controls_vehicle(uuid,uuid),
 public.cargo_photo_driver_assignment(uuid,uuid),public.cargo_photo_workspace_granted(uuid,uuid),
 public.cargo_photo_workspace_can_view(uuid,uuid,uuid),
 public.cargo_photo_reserve(uuid,uuid,text,text,timestamptz,integer),
 public.cargo_photo_activate(uuid,uuid),public.cargo_photo_mark_delete(uuid,uuid),
 public.cargo_photo_discard_pending(uuid,uuid),
 public.cargo_photo_cleanup_candidates(integer),
 public.cargo_photo_provider_state(uuid,uuid),public.cargo_photo_business_summary(uuid,uuid,uuid),
 public.cargo_photo_business_file(uuid,uuid,uuid),public.cargo_photo_request(uuid,uuid,uuid,uuid)
 ,public.cargo_photo_provider_file(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.cargo_photo_owner_controls_vehicle(uuid,uuid),
 public.cargo_photo_driver_assignment(uuid,uuid),public.cargo_photo_workspace_granted(uuid,uuid),
 public.cargo_photo_workspace_can_view(uuid,uuid,uuid),
 public.cargo_photo_reserve(uuid,uuid,text,text,timestamptz,integer),
 public.cargo_photo_activate(uuid,uuid),public.cargo_photo_mark_delete(uuid,uuid),
 public.cargo_photo_discard_pending(uuid,uuid),
 public.cargo_photo_cleanup_candidates(integer),
 public.cargo_photo_provider_state(uuid,uuid),public.cargo_photo_business_summary(uuid,uuid,uuid),
 public.cargo_photo_business_file(uuid,uuid,uuid),public.cargo_photo_request(uuid,uuid,uuid,uuid)
 ,public.cargo_photo_provider_file(uuid,uuid)
 to service_role;
notify pgrst,'reload schema';
commit;
