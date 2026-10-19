-- FEAT-SIM/MOB/CAP/TRK-001. Private app installation identity, not hardware IMEI.
-- Additive local candidate. No recipient projection includes these identifiers.
begin;
select pg_advisory_xact_lock(8030157);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.phone_location_installations(
 id uuid primary key,secret_digest text not null check(secret_digest~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),last_seen_at timestamptz not null default clock_timestamp()
);
create table public.phone_location_bindings(
 id uuid primary key default gen_random_uuid(),installation_id uuid not null references public.phone_location_installations(id),
 actor_user_id uuid not null references public.profiles(id) on delete cascade,vehicle_id uuid not null references public.vehicles(id) on delete cascade,
 revision uuid not null default gen_random_uuid(),created_at timestamptz not null default clock_timestamp(),
 auth_session_id uuid not null,
 expires_at timestamptz not null,revoked_at timestamptz,revocation_reason text,
 last_observed_at timestamptz,last_report_id uuid,
 last_accuracy_m double precision check(last_accuracy_m between 0 and 40000),
 last_speed_kph double precision check(last_speed_kph between 0 and 300),
 last_heading_deg double precision check(last_heading_deg>=0 and last_heading_deg<360),
 check((revoked_at is null)=(revocation_reason is null))
);
create unique index phone_location_current_vehicle on public.phone_location_bindings(vehicle_id) where revoked_at is null;
create unique index phone_location_current_installation on public.phone_location_bindings(installation_id) where revoked_at is null;
create index phone_location_actor_idx on public.phone_location_bindings(actor_user_id,vehicle_id,created_at desc);
create table public.phone_location_report_receipts(
 binding_id uuid not null references public.phone_location_bindings(id) on delete cascade,
 report_id uuid not null,observed_at timestamptz not null,created_at timestamptz not null default clock_timestamp(),
 primary key(binding_id,report_id)
);
alter table public.vehicle_driver_locations add column phone_binding_id uuid references public.phone_location_bindings(id) on delete set null,add column observed_at timestamptz;
alter table public.provider_shipment_events add column phone_binding_id uuid references public.phone_location_bindings(id) on delete set null,add column location_observed_at timestamptz;
alter table public.tracking_device_leases add column phone_binding_id uuid references public.phone_location_bindings(id) on delete set null,add column phone_binding_revision uuid;
do $private$ declare name text;begin
 foreach name in array array['phone_location_installations','phone_location_bindings','phone_location_report_receipts'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on public.%I from public,anon,authenticated',name);
  execute format('grant select,insert,update,delete on public.%I to service_role',name);
 end loop;
end $private$;

create function public.phone_location_binding_is_current(target_binding_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from phone_location_bindings b join profiles p on p.id=b.actor_user_id and p.active
  join auth.sessions s on s.id=b.auth_session_id and s.user_id=b.actor_user_id and (s.not_after is null or s.not_after>clock_timestamp())
  where b.id=target_binding_id and b.revoked_at is null and b.expires_at>clock_timestamp()
   and (p.role='DRIVER' or p.role='TRANSPORTER' and p.drives_truck)
   and public.capacity_active_driver_id(b.vehicle_id)=b.actor_user_id and public.fleet_actor_can_use_vehicle(b.actor_user_id,b.vehicle_id))
$$;
create function public.real_location_device_in_use(target_vehicle_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 -- A reporting lease may expire while an actual phone remains signed in. That
 -- silence must never authorize synthetic movement to resume behind its back.
 select exists(select 1 from phone_location_bindings b join profiles p on p.id=b.actor_user_id and p.active
  join auth.sessions s on s.id=b.auth_session_id and s.user_id=b.actor_user_id and (s.not_after is null or s.not_after>clock_timestamp())
  where b.vehicle_id=target_vehicle_id and b.revoked_at is null
   and (p.role='DRIVER' or p.role='TRANSPORTER' and p.drives_truck)
   and public.capacity_active_driver_id(b.vehicle_id)=b.actor_user_id and public.fleet_actor_can_use_vehicle(b.actor_user_id,b.vehicle_id))
$$;

create function public.register_phone_location_installation(actor_user_id uuid,target_installation_id uuid,installation_secret_digest text,
 target_vehicle_id uuid default null,allow_takeover boolean default false,authenticated_session_id uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare vehicle uuid;counted integer;installation phone_location_installations%rowtype;binding phone_location_bindings%rowtype;stamp timestamptz:=clock_timestamp();
begin
 if target_installation_id is null or authenticated_session_id is null or installation_secret_digest is null or installation_secret_digest!~'^[a-f0-9]{64}$'
  or not exists(select 1 from profiles p where p.id=actor_user_id and p.active and (p.role='DRIVER' or p.role='TRANSPORTER' and p.drives_truck)) then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from auth.sessions s where s.id=authenticated_session_id and s.user_id=actor_user_id and (s.not_after is null or s.not_after>clock_timestamp())) then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 select count(*),min(a.vehicle_id::text)::uuid into counted,vehicle from driver_vehicle_assignments a join vehicles v on v.id=a.vehicle_id and v.active
  where a.driver_user_id=actor_user_id and a.active and (target_vehicle_id is null or a.vehicle_id=target_vehicle_id);
 if counted<>1 or not public.fleet_actor_can_use_vehicle(actor_user_id,vehicle) then raise exception 'NOT_FOUND';end if;
 -- Shared demo arbitration locks its scope/device/truck first. Enrollment pauses
 -- synthetic reporting before the OS permission dialog or first GPS capture.
 perform public.note_real_location_device_use(actor_user_id,vehicle,target_installation_id);
 perform 1 from vehicles where id=vehicle for update;
 if public.capacity_active_driver_id(vehicle) is distinct from actor_user_id or not public.fleet_actor_can_use_vehicle(actor_user_id,vehicle) then raise exception 'NOT_FOUND';end if;
 insert into phone_location_installations(id,secret_digest) values(target_installation_id,installation_secret_digest) on conflict do nothing;
 select * into installation from phone_location_installations where id=target_installation_id for update;
 stamp:=clock_timestamp();
 if installation.secret_digest is distinct from installation_secret_digest then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 -- A superseded phone cannot reclaim authority through its periodic synchronizer.
 if not allow_takeover and exists(select 1 from phone_location_bindings b where b.installation_id=target_installation_id and b.actor_user_id=actor_user_id and b.vehicle_id=vehicle and b.revocation_reason='SUPERSEDED')
  and not exists(select 1 from phone_location_bindings b where b.installation_id=target_installation_id and b.actor_user_id=actor_user_id and b.vehicle_id=vehicle and b.revoked_at is null) then raise exception 'PHONE_LOCATION_SUPERSEDED';end if;
 select * into binding from phone_location_bindings b where b.vehicle_id=vehicle and b.revoked_at is null for update;
 if found and binding.installation_id<>target_installation_id and public.phone_location_binding_is_current(binding.id) and not allow_takeover then raise exception 'PHONE_LOCATION_IN_USE';end if;
 if binding.id is not null and binding.installation_id=target_installation_id and binding.actor_user_id=actor_user_id and binding.auth_session_id=authenticated_session_id and binding.expires_at>stamp then
  update phone_location_bindings set expires_at=stamp+interval '24 hours',auth_session_id=authenticated_session_id where id=binding.id returning * into binding;
 else
  update tracking_device_leases l set revoked_at=stamp where l.revoked_at is null and l.phone_binding_id in(
   select b.id from phone_location_bindings b where b.revoked_at is null and (b.vehicle_id=vehicle or b.installation_id=target_installation_id));
  update phone_location_bindings b set revoked_at=stamp,revocation_reason='SUPERSEDED'
   where b.revoked_at is null and (b.vehicle_id=vehicle or b.installation_id=target_installation_id);
  insert into phone_location_bindings(installation_id,actor_user_id,vehicle_id,expires_at,auth_session_id)
   values(target_installation_id,actor_user_id,vehicle,stamp+interval '24 hours',authenticated_session_id) returning * into binding;
 end if;
 update phone_location_installations set last_seen_at=stamp where id=target_installation_id;
 return jsonb_build_object('installationId',installation.id,'bindingId',binding.id,'revision',binding.revision,'vehicleId',vehicle,'actorId',actor_user_id,'expiresAt',binding.expires_at);
end $$;

create function public.revoke_phone_location_auth_session(actor_user_id uuid,authenticated_session_id uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare vehicle uuid;stamp timestamptz:=clock_timestamp();
begin
 if actor_user_id is null or authenticated_session_id is null then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 for vehicle in select b.vehicle_id from phone_location_bindings b where b.actor_user_id=actor_user_id and b.auth_session_id=authenticated_session_id and b.revoked_at is null order by b.vehicle_id loop
  perform 1 from vehicles where id=vehicle for update;
  update phone_location_bindings b set revoked_at=stamp,revocation_reason='LOGOUT' where b.actor_user_id=actor_user_id and b.auth_session_id=authenticated_session_id and b.vehicle_id=vehicle and b.revoked_at is null;
 end loop;
 update tracking_device_leases set revoked_at=stamp where revoked_at is null and phone_binding_id in(select b.id from phone_location_bindings b where b.actor_user_id=actor_user_id and b.auth_session_id=authenticated_session_id and b.revoked_at is not null);
 return true;
end $$;

create function public.release_phone_location_installation(target_installation_id uuid,installation_secret_digest text,target_binding_id uuid,expected_revision uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare vehicle uuid;binding phone_location_bindings%rowtype;stamp timestamptz:=clock_timestamp();
begin
 select b.vehicle_id into vehicle from phone_location_bindings b join phone_location_installations i on i.id=b.installation_id
  where b.id=target_binding_id and b.revision=expected_revision and i.id=target_installation_id and i.secret_digest=installation_secret_digest;
 if vehicle is null then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 perform 1 from vehicles where id=vehicle for update;
 select * into binding from phone_location_bindings where id=target_binding_id for update;
 if binding.revision is distinct from expected_revision then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 update phone_location_bindings set revoked_at=coalesce(revoked_at,stamp),revocation_reason=coalesce(revocation_reason,'RELEASED') where id=binding.id;
 update tracking_device_leases set revoked_at=stamp where phone_binding_id=binding.id and revoked_at is null;
 return true;
end $$;

-- Returns NULL on an exact replay. A missing proof is never silently converted
 -- to registered-phone authority; existing browser commands remain separate.
create function public.authorize_phone_location_report(actor_user_id uuid,target_vehicle_id uuid,proof jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare binding phone_location_bindings%rowtype;observed timestamptz;report uuid;stamp timestamptz:=clock_timestamp();accuracy double precision;speed double precision;heading double precision;
begin
 if jsonb_typeof(proof) is distinct from 'object' then raise exception 'INVALID_PHONE_LOCATION';end if;
 perform 1 from vehicles where id=target_vehicle_id for update;
 select b.* into binding from phone_location_bindings b join phone_location_installations i on i.id=b.installation_id
  where b.id=(proof->>'binding_id')::uuid and b.installation_id=(proof->>'installation_id')::uuid and i.secret_digest=proof->>'secret_digest'
   and b.revision=(proof->>'revision')::uuid and b.actor_user_id=actor_user_id and b.vehicle_id=target_vehicle_id for update of b;
 stamp:=clock_timestamp();
 if not found or not public.phone_location_binding_is_current(binding.id) or public.capacity_active_driver_id(target_vehicle_id) is distinct from actor_user_id
  or not public.fleet_actor_can_use_vehicle(actor_user_id,target_vehicle_id)
  or coalesce((select source from telematics_location_sources where vehicle_id=target_vehicle_id),'MOBILE')<>'MOBILE' then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 observed:=(proof->>'observed_at')::timestamptz;report:=(proof->>'report_id')::uuid;
 accuracy:=(proof->>'accuracy_m')::double precision;speed:=(proof->>'speed_kph')::double precision;heading:=(proof->>'heading_deg')::double precision;
 if accuracy is not null and not(accuracy between 0 and 40000) or speed is not null and not(speed between 0 and 300) or heading is not null and not(heading>=0 and heading<360) then raise exception 'INVALID_PHONE_LOCATION';end if;
 if observed is null or report is null or observed<stamp-interval '2 minutes' or observed>stamp+interval '30 seconds'
  or observed<binding.created_at-interval '1 second' or observed<coalesce(binding.last_observed_at,'-infinity'::timestamptz)
  or observed<coalesce((select selected_at from telematics_location_sources where vehicle_id=target_vehicle_id),'-infinity'::timestamptz) then raise exception 'INVALID_PHONE_LOCATION';end if;
 insert into phone_location_report_receipts(binding_id,report_id,observed_at) values(binding.id,report,observed) on conflict do nothing;
 if not found then return null;end if;
 update phone_location_bindings set last_observed_at=observed,last_report_id=report,last_accuracy_m=accuracy,last_speed_kph=speed,last_heading_deg=heading,expires_at=stamp+interval '24 hours' where id=binding.id;
 update phone_location_installations set last_seen_at=stamp where id=binding.installation_id;
 return binding.id;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception 'INVALID_PHONE_LOCATION';
end $$;

-- Keep the existing governed transitions and proof/assignment checks. Private
 -- wrappers add attribution and observation-order checks, never new map data.
alter function public.refresh_provider_capacity_location(uuid,jsonb) rename to refresh_provider_capacity_location_pre_phone157;
create function public.refresh_provider_capacity_location(actor_user_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare binding uuid;result jsonb;vehicle uuid:=(command->>'vehicle_id')::uuid;observed timestamptz;
begin
 perform public.note_real_location_device_use(actor_user_id,vehicle,coalesce((command->'phone_installation'->>'installation_id')::uuid,gen_random_uuid()));
 perform 1 from vehicles where id=vehicle for update;
 if not command?'phone_installation' and public.real_location_device_in_use(vehicle) then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 if command?'phone_installation' then
  binding:=authorize_phone_location_report(actor_user_id,vehicle,command->'phone_installation');
  if binding is null then return jsonb_build_object('recorded',false,'reason','THROTTLED');end if;
  observed:=(command->'phone_installation'->>'observed_at')::timestamptz;
 end if;
 result:=refresh_provider_capacity_location_pre_phone157(actor_user_id,command-'phone_installation');
 if binding is not null then
  update vehicle_driver_locations set phone_binding_id=binding,observed_at=observed,updated_at=observed where vehicle_id=vehicle and driver_user_id=actor_user_id;
  update capacities set location_updated_at=observed where id=(result->>'capacityId')::uuid and location_source='DEVICE_OBSCURED' and coalesce((select source from telematics_location_sources where vehicle_id=vehicle),'MOBILE')='MOBILE';
  result:=result||jsonb_build_object('locationUpdatedAt',observed);
 end if;
 return result;
end $$;

alter function public.set_provider_assigned_vehicle_duty(uuid,jsonb) rename to set_provider_assigned_vehicle_duty_pre_phone157;
create function public.set_provider_assigned_vehicle_duty(actor_user_id uuid,command jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare binding uuid;result uuid;vehicle uuid:=(command->>'vehicle_id')::uuid;observed timestamptz;
begin
 if (command->>'on_duty')::boolean and coalesce((select source from telematics_location_sources where vehicle_id=vehicle),'MOBILE')='MOBILE' then
  perform public.note_real_location_device_use(actor_user_id,vehicle,coalesce((command->'phone_installation'->>'installation_id')::uuid,gen_random_uuid()));
 end if;
 perform 1 from vehicles where id=vehicle for update;
 if (command->>'on_duty')::boolean and not command?'phone_installation' and public.real_location_device_in_use(vehicle) and coalesce((select source from telematics_location_sources where vehicle_id=vehicle),'MOBILE')='MOBILE' then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 if command?'phone_installation' and (command->>'on_duty')::boolean then
  binding:=authorize_phone_location_report(actor_user_id,vehicle,command->'phone_installation');
  if binding is null then raise exception 'INVALID_PHONE_LOCATION';end if;
  observed:=(command->'phone_installation'->>'observed_at')::timestamptz;
 end if;
 result:=set_provider_assigned_vehicle_duty_pre_phone157(actor_user_id,command-'phone_installation');
 if binding is not null then update capacities set location_updated_at=observed where id=result and location_source='DEVICE_OBSCURED';end if;
 return result;
end $$;

alter function public.update_provider_tracking_location(uuid,uuid,jsonb) rename to update_provider_tracking_location_pre_phone157;
create function public.update_provider_tracking_location(actor_user_id uuid,target_shipment_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare binding uuid;result jsonb;vehicle uuid;observed timestamptz;started timestamptz:=clock_timestamp();
begin
 select assigned_vehicle_id into vehicle from provider_shipments where id=target_shipment_id;
 perform public.note_real_location_device_use(actor_user_id,vehicle,coalesce((command->'phone_installation'->>'installation_id')::uuid,gen_random_uuid()));
 perform 1 from vehicles where id=vehicle for update;
 if not command?'phone_installation' and public.real_location_device_in_use(vehicle) then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 if command?'phone_installation' then
  binding:=authorize_phone_location_report(actor_user_id,vehicle,command->'phone_installation');
  if binding is null then return jsonb_build_object('recorded',false,'reason','THROTTLED');end if;
  observed:=(command->'phone_installation'->>'observed_at')::timestamptz;
 end if;
 result:=update_provider_tracking_location_pre_phone157(actor_user_id,target_shipment_id,command-'phone_installation');
 if binding is not null and result->>'recorded'='true' then
  update provider_shipment_events set phone_binding_id=binding,location_observed_at=observed where shipment_id=target_shipment_id and created_by=actor_user_id and event_type='LOCATION' and created_at>=started;
 end if;
 return result;
end $$;

alter function public.update_provider_tracking_status(uuid,uuid,jsonb) rename to update_provider_tracking_status_pre_phone157;
create function public.update_provider_tracking_status(actor_user_id uuid,target_shipment_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare binding uuid;result jsonb;vehicle uuid;observed timestamptz;started timestamptz:=clock_timestamp();
begin
 select assigned_vehicle_id into vehicle from provider_shipments where id=target_shipment_id;
 if command->'location' is not null and command->'location'<>'null'::jsonb then
  perform public.note_real_location_device_use(actor_user_id,vehicle,coalesce((command->'location'->'phone_installation'->>'installation_id')::uuid,gen_random_uuid()));
  perform 1 from vehicles where id=vehicle for update;
 end if;
 if command->'location' is not null and command->'location'<>'null'::jsonb and not(command->'location'?'phone_installation') and public.real_location_device_in_use(vehicle) then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 if command->'location'?'phone_installation' then
  binding:=authorize_phone_location_report(actor_user_id,vehicle,command->'location'->'phone_installation');
  if binding is null then raise exception 'INVALID_PHONE_LOCATION';end if;
  observed:=(command->'location'->'phone_installation'->>'observed_at')::timestamptz;
 end if;
 result:=update_provider_tracking_status_pre_phone157(actor_user_id,target_shipment_id,case when command->'location'?'phone_installation' then jsonb_set(command,'{location}',(command->'location')-'phone_installation') else command end);
 if binding is not null then update provider_shipment_events set phone_binding_id=binding,location_observed_at=observed where shipment_id=target_shipment_id and created_by=actor_user_id and created_at>=started and location_source='DEVICE_OBSCURED';end if;
 return result;
end $$;

create function public.issue_registered_tracking_device_lease(actor_user_id uuid,target_shipment_id uuid,target_device_id uuid,installation_secret_digest text,capability_digest text,privacy_radius integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare binding phone_location_bindings%rowtype;vehicle uuid;result jsonb;
begin
 select assigned_vehicle_id into vehicle from provider_shipments where id=target_shipment_id;
 perform 1 from vehicles where id=vehicle for update;
 select b.* into binding from phone_location_bindings b join phone_location_installations i on i.id=b.installation_id
  where b.vehicle_id=vehicle and b.actor_user_id=actor_user_id and b.installation_id=target_device_id and i.secret_digest=installation_secret_digest
   and public.phone_location_binding_is_current(b.id) for update of b;
 if not found or coalesce((select source from telematics_location_sources where vehicle_id=vehicle),'MOBILE')<>'MOBILE' then raise exception 'PHONE_LOCATION_UNAVAILABLE';end if;
 result:=issue_tracking_device_lease(actor_user_id,target_shipment_id,target_device_id,capability_digest,privacy_radius);
 update tracking_device_leases set phone_binding_id=binding.id,phone_binding_revision=binding.revision where token_digest=capability_digest;
 return result||jsonb_build_object('bindingId',binding.id,'bindingRevision',binding.revision);
end $$;

alter function public.report_tracking_device_location(text,jsonb) rename to report_tracking_device_location_pre_phone157;
create function public.report_tracking_device_location(capability_digest text,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare lease tracking_device_leases%rowtype;binding phone_location_bindings%rowtype;secret text;proof jsonb;result jsonb;
begin
 select * into lease from tracking_device_leases where token_digest=capability_digest;
 if not found or lease.phone_binding_id is null then raise exception 'TRACKING_DEVICE_UNAVAILABLE';end if;
 select * into binding from phone_location_bindings where id=lease.phone_binding_id;
 if not found or not public.phone_location_binding_is_current(binding.id) or binding.revision is distinct from lease.phone_binding_revision
  or lease.revoked_at is not null or lease.expires_at<=clock_timestamp() then raise exception 'TRACKING_DEVICE_UNAVAILABLE';end if;
 perform public.note_real_location_device_use(binding.actor_user_id,binding.vehicle_id,binding.installation_id);
 perform 1 from vehicles where id=binding.vehicle_id for update;
 select secret_digest into secret from phone_location_installations where id=binding.installation_id;
 proof:=jsonb_build_object('installation_id',binding.installation_id,'binding_id',binding.id,'revision',lease.phone_binding_revision,'secret_digest',secret,
  'report_id',command->>'report_id','observed_at',command->>'observed_at','accuracy_m',command->'accuracy_m','speed_kph',command->'speed_kph','heading_deg',command->'heading_deg');
 -- The old reporter calls the new location wrapper, which repeats current
 -- binding/source checks after its shipment lock and keeps existing throttling.
 result:=report_tracking_device_location_pre_phone157(capability_digest,command||jsonb_build_object('phone_installation',proof));
 return result;
end $$;

-- Reassignment/account closure invalidates device authority immediately; no
 -- browser-owned callback can resurrect it. Account logout also uses RELEASE.
create function public.revoke_reassigned_phone_locations() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
begin
 if old.active and (not new.active or new.driver_user_id is distinct from old.driver_user_id or new.vehicle_id is distinct from old.vehicle_id) then
  update phone_location_bindings set revoked_at=clock_timestamp(),revocation_reason='ASSIGNMENT_CHANGED' where vehicle_id=old.vehicle_id and actor_user_id=old.driver_user_id and revoked_at is null;
  update tracking_device_leases set revoked_at=clock_timestamp() where phone_binding_id in(select id from phone_location_bindings where vehicle_id=old.vehicle_id and revoked_at is not null) and revoked_at is null;
 end if;return new;
end $$;
create trigger phone_location_assignment_changed after update of active,driver_user_id,vehicle_id on public.driver_vehicle_assignments for each row execute function public.revoke_reassigned_phone_locations();

create function public.revoke_inactive_phone_locations() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
begin
 if not new.active or (new.role<>'DRIVER' and not(new.role='TRANSPORTER' and new.drives_truck)) then
  update phone_location_bindings set revoked_at=clock_timestamp(),revocation_reason='ACCOUNT_CHANGED' where actor_user_id=new.id and revoked_at is null;
  update tracking_device_leases set revoked_at=clock_timestamp() where driver_user_id=new.id and revoked_at is null;
 end if;return new;
end $$;
create trigger phone_location_account_changed after update of active,role,drives_truck on public.profiles for each row execute function public.revoke_inactive_phone_locations();
create function public.erase_unbound_phone_installation() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
begin delete from phone_location_installations i where i.id=old.installation_id and not exists(select 1 from phone_location_bindings b where b.installation_id=i.id);return old;end $$;
create trigger erase_unbound_phone_installation after delete on public.phone_location_bindings for each row execute function public.erase_unbound_phone_installation();

-- Private Fleet metadata only; recipient/public projections never call this.
create function public.phone_location_source_summary(target_vehicle_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('installationId',b.installation_id,'connected',public.phone_location_binding_is_current(b.id),
  'lastObservedAt',b.last_observed_at,'expiresAt',b.expires_at,'accuracyMeters',b.last_accuracy_m,'speedKph',b.last_speed_kph,'headingDegrees',b.last_heading_deg)
 from phone_location_bindings b where b.vehicle_id=target_vehicle_id order by b.created_at desc,b.id desc limit 1
$$;
create function public.phone_location_workspace(actor_user_id uuid,target_vehicle_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
begin
 if not public.fleet_actor_can_use_vehicle(actor_user_id,target_vehicle_id,true) and public.capacity_active_driver_id(target_vehicle_id) is distinct from actor_user_id then raise exception 'NOT_FOUND';end if;
 if not exists(select 1 from profiles where id=actor_user_id and active) then raise exception 'NOT_FOUND';end if;
 if not public.fleet_actor_can_use_vehicle(actor_user_id,target_vehicle_id,true) and not exists(select 1 from phone_location_bindings b where b.vehicle_id=target_vehicle_id and b.actor_user_id=actor_user_id and b.revoked_at is null) then return null;end if;
 return public.phone_location_source_summary(target_vehicle_id);
end $$;

alter function public.telematics_workspace(uuid,integer) rename to telematics_workspace_pre_phone157;
create function public.telematics_workspace(actor_user_id uuid,requested_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare result jsonb;vehicles jsonb;
begin
 result:=telematics_workspace_pre_phone157(actor_user_id,requested_page);
 select coalesce(jsonb_agg(v.value||jsonb_build_object('phone',public.phone_location_source_summary((v.value->>'id')::uuid)) order by v.ordinality),'[]'::jsonb)
  into vehicles from jsonb_array_elements(result->'vehicles') with ordinality as v(value,ordinality);
 return jsonb_set(result,'{vehicles}',vehicles);
end $$;

-- Older independent capabilities lack a registered installation. Their rows
-- remain untouched; the reporter denies unbound authority until foreground
-- authentication issues a registered lease. Rollout must communicate this.

do $permissions$ declare name regprocedure;begin
 foreach name in array array[
 'public.real_location_device_in_use(uuid)'::regprocedure,
 'public.register_phone_location_installation(uuid,uuid,text,uuid,boolean,uuid)'::regprocedure,
 'public.revoke_phone_location_auth_session(uuid,uuid)'::regprocedure,
 'public.release_phone_location_installation(uuid,text,uuid,uuid)'::regprocedure,
 'public.authorize_phone_location_report(uuid,uuid,jsonb)'::regprocedure,
 'public.phone_location_binding_is_current(uuid)'::regprocedure,
 'public.refresh_provider_capacity_location(uuid,jsonb)'::regprocedure,
 'public.set_provider_assigned_vehicle_duty(uuid,jsonb)'::regprocedure,
 'public.update_provider_tracking_location(uuid,uuid,jsonb)'::regprocedure,
 'public.update_provider_tracking_status(uuid,uuid,jsonb)'::regprocedure,
 'public.issue_registered_tracking_device_lease(uuid,uuid,uuid,text,text,integer)'::regprocedure,
 'public.report_tracking_device_location(text,jsonb)'::regprocedure,
 'public.phone_location_workspace(uuid,uuid)'::regprocedure] loop
  execute format('revoke all on function %s from public,anon,authenticated',name);
  execute format('grant execute on function %s to service_role',name);
 end loop;
 foreach name in array array['public.refresh_provider_capacity_location_pre_phone157(uuid,jsonb)'::regprocedure,
 'public.update_provider_tracking_location_pre_phone157(uuid,uuid,jsonb)'::regprocedure,
 'public.update_provider_tracking_status_pre_phone157(uuid,uuid,jsonb)'::regprocedure,
 'public.report_tracking_device_location_pre_phone157(text,jsonb)'::regprocedure,
 'public.set_provider_assigned_vehicle_duty_pre_phone157(uuid,jsonb)'::regprocedure,
 'public.issue_tracking_device_lease(uuid,uuid,uuid,text,integer)'::regprocedure,
 'public.authorize_phone_location_report(uuid,uuid,jsonb)'::regprocedure,
 'public.phone_location_binding_is_current(uuid)'::regprocedure,
 'public.phone_location_source_summary(uuid)'::regprocedure,
 'public.telematics_workspace_pre_phone157(uuid,integer)'::regprocedure,
 'public.revoke_reassigned_phone_locations()'::regprocedure,
 'public.revoke_inactive_phone_locations()'::regprocedure,
 'public.erase_unbound_phone_installation()'::regprocedure] loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',name);
 end loop;
end $permissions$;
revoke all on function public.telematics_workspace(uuid,integer) from public,anon,authenticated;
grant execute on function public.telematics_workspace(uuid,integer) to service_role;
commit;
