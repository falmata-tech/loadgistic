-- FEAT-TRK-001 / FEAT-MOB-001: least-privilege background location capability.
create table public.tracking_device_leases(
 id uuid primary key default gen_random_uuid(),shipment_id uuid not null references public.provider_shipments(id),
 driver_user_id uuid not null references public.profiles(id),device_id uuid not null,token_digest text not null unique check(token_digest ~ '^[a-f0-9]{64}$'),
 privacy_km integer not null check(privacy_km in (1,3,5,10,20)),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 revoked_at timestamptz,last_report_at timestamptz,
 unique(shipment_id,driver_user_id,device_id)
);
alter table public.tracking_device_leases enable row level security;
revoke all on public.tracking_device_leases from public,anon,authenticated;
grant select,insert,update,delete on public.tracking_device_leases to service_role;
create function public.assigned_location_tracking(actor_user_id uuid) returns table(payload jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('shipmentId',s.id,'radius',least(20,coalesce((select e.location_precision_km from public.provider_shipment_events e
 where e.shipment_id=s.id and e.location_source='DEVICE_OBSCURED' order by e.created_at desc,e.id desc limit 1),20)))
 from public.provider_shipments s join public.profiles p on p.id=actor_user_id and p.active and p.role='DRIVER'
 where s.assigned_driver_user_id=actor_user_id and s.tracking_mode='LOCATION_AND_STATUS' and s.operational_status not in ('COMPLETED','CANCELLED')
 and public.provider_tracking_actor_owns_shipment(actor_user_id,s.id)
 order by s.created_at,s.id
$$;
create function public.issue_tracking_device_lease(actor_user_id uuid,target_shipment_id uuid,target_device_id uuid,capability_digest text,privacy_radius integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare shipment public.provider_shipments%rowtype; lease public.tracking_device_leases%rowtype;stamp timestamptz:=clock_timestamp();
begin
 select * into shipment from public.provider_shipments where id=target_shipment_id for update;
 if not found or shipment.assigned_driver_user_id is distinct from actor_user_id
 or shipment.tracking_mode<>'LOCATION_AND_STATUS' or shipment.operational_status in ('COMPLETED','CANCELLED')
 or not public.provider_tracking_actor_owns_shipment(actor_user_id,target_shipment_id)
 or not exists(select 1 from public.profiles where id=actor_user_id and active and role='DRIVER') then raise exception 'NOT_FOUND';end if;
 if target_device_id is null or capability_digest is null or capability_digest !~ '^[a-f0-9]{64}$' or privacy_radius is null or privacy_radius not in (1,3,5,10,20) then raise exception 'INVALID_TRACKING_DEVICE';end if;
 insert into public.tracking_device_leases(shipment_id,driver_user_id,device_id,token_digest,privacy_km,created_at,expires_at)
 values(shipment.id,actor_user_id,target_device_id,capability_digest,privacy_radius,stamp,stamp+interval '24 hours')
 on conflict(shipment_id,driver_user_id,device_id) do update set token_digest=excluded.token_digest,privacy_km=excluded.privacy_km,
 created_at=excluded.created_at,expires_at=excluded.expires_at,revoked_at=null
 returning * into lease;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'TRACKING_DEVICE_ENABLED','provider_shipment',shipment.id,jsonb_build_object('leaseId',lease.id,'privacyKm',privacy_radius));
 return jsonb_build_object('shipmentId',shipment.id,'expiresAt',lease.expires_at,'absoluteExpiresAt',stamp+interval '30 days','radius',lease.privacy_km);
end;
$$;
create function public.report_tracking_device_location(capability_digest text,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare lease public.tracking_device_leases%rowtype;shipment public.provider_shipments%rowtype;result jsonb;stamp timestamptz:=clock_timestamp();observed timestamptz;
begin
 select * into lease from public.tracking_device_leases where token_digest=capability_digest;
 if not found then raise exception 'TRACKING_DEVICE_UNAVAILABLE';end if;
 select * into shipment from public.provider_shipments where id=lease.shipment_id for update;
 select * into lease from public.tracking_device_leases where id=lease.id for update;
 if lease.token_digest is distinct from capability_digest or lease.revoked_at is not null or lease.expires_at<=stamp
 or lease.created_at+interval '30 days'<=stamp or shipment.assigned_driver_user_id is distinct from lease.driver_user_id
 or shipment.operational_status in ('COMPLETED','CANCELLED') or shipment.tracking_mode<>'LOCATION_AND_STATUS'
 or not exists(select 1 from public.profiles where id=lease.driver_user_id and active and role='DRIVER')
 or not public.provider_tracking_actor_owns_shipment(lease.driver_user_id,shipment.id) then raise exception 'TRACKING_DEVICE_UNAVAILABLE';end if;
 if jsonb_typeof(command) is distinct from 'object' or command->>'source' is distinct from 'DEVICE_OBSCURED'
 or (command->>'precision_km')::integer is distinct from lease.privacy_km then raise exception 'INVALID_TRACKING_DEVICE_LOCATION';end if;
 observed:=(command->>'observed_at')::timestamptz;
 if observed is null or observed<stamp-interval '2 minutes' or observed>stamp+interval '30 seconds' then raise exception 'INVALID_TRACKING_DEVICE_LOCATION';end if;
 result:=public.update_provider_tracking_location(lease.driver_user_id,shipment.id,command);
 update public.tracking_device_leases set expires_at=least(stamp+interval '24 hours',created_at+interval '30 days'),
 last_report_at=case when result->>'recorded'='true' then stamp else last_report_at end where id=lease.id;
 return result;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
 raise exception 'INVALID_TRACKING_DEVICE_LOCATION';
end;
$$;
create function public.revoke_tracking_device_lease(capability_digest text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin update public.tracking_device_leases set revoked_at=clock_timestamp() where token_digest=capability_digest and revoked_at is null;return found;end;
$$;
create function public.stop_released_tracking_devices() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.operational_status in ('COMPLETED','CANCELLED') or new.assigned_driver_user_id is distinct from old.assigned_driver_user_id
 or new.assigned_vehicle_id is distinct from old.assigned_vehicle_id then
  update public.tracking_device_leases set revoked_at=clock_timestamp() where shipment_id=new.id and revoked_at is null;
 end if;return new;
end;
$$;
create trigger stop_released_tracking_devices after update of operational_status,assigned_driver_user_id,assigned_vehicle_id on public.provider_shipments
 for each row execute function public.stop_released_tracking_devices();
revoke all on function public.assigned_location_tracking(uuid),public.issue_tracking_device_lease(uuid,uuid,uuid,text,integer),
 public.report_tracking_device_location(text,jsonb),public.revoke_tracking_device_lease(text),public.stop_released_tracking_devices() from public,anon,authenticated;
grant execute on function public.assigned_location_tracking(uuid),public.issue_tracking_device_lease(uuid,uuid,uuid,text,integer),
 public.report_tracking_device_location(text,jsonb),public.revoke_tracking_device_lease(text) to service_role;
