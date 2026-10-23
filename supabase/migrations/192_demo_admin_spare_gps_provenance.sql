-- FEAT-GPS-001. Preserve Demo provenance for the exact Admin intake spare.
-- The spare is outside recurring demo motion, so its ordinary GT06 reports
-- have no motion epoch. No device, target, command or public signal is created.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create function public.mark_demo_admin_spare_gps_fix()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.telematics_devices d
  join public.telematics_gateways g on g.id=d.gateway_id and g.active and g.synthetic_only
  where d.id=new.device_id and d.gateway_id=new.gateway_id and d.active
   and d.imei='990000000000013' and d.protocol='gt06'
   and d.protocol_device_id='990000000000013' and d.synthetic
   and d.model_profile='SYNTHETIC_GT06'
   and d.organization_id='6727b198-d771-436a-9f1f-7bf27b8cea2f'
   and d.provider_profile_id is null)
 then new.demo_epoch:=1;end if;
 return new;
end $$;
revoke all on function public.mark_demo_admin_spare_gps_fix() from public,anon,authenticated,service_role;
create trigger mark_demo_admin_spare_gps_fix before insert on public.telematics_positions
 for each row execute function public.mark_demo_admin_spare_gps_fix();

-- Reconcile only saved fixes from this same exact binding. Existing movement
-- targets and all other provider telemetry remain untouched.
do $backfill$
declare matched integer;
begin
 select count(*) into matched from public.telematics_positions p
  join public.telematics_devices d on d.id=p.device_id and d.gateway_id=p.gateway_id
  join public.telematics_gateways g on g.id=d.gateway_id and g.active and g.synthetic_only
  where d.imei='990000000000013' and d.protocol='gt06'
   and d.protocol_device_id='990000000000013' and d.synthetic
   and d.model_profile='SYNTHETIC_GT06' and d.active
   and d.organization_id='6727b198-d771-436a-9f1f-7bf27b8cea2f'
   and d.provider_profile_id is null;
 if matched>100 then raise exception 'DEMO_ADMIN_SPARE_BACKFILL_BOUND';end if;
 update public.telematics_positions p set demo_epoch=1
 from public.telematics_devices d
 join public.telematics_gateways g on g.id=d.gateway_id and g.active and g.synthetic_only
 where p.device_id=d.id and p.gateway_id=d.gateway_id
  and d.imei='990000000000013' and d.protocol='gt06'
  and d.protocol_device_id='990000000000013' and d.synthetic
  and d.model_profile='SYNTHETIC_GT06' and d.active
  and d.organization_id='6727b198-d771-436a-9f1f-7bf27b8cea2f'
  and d.provider_profile_id is null and p.demo_epoch is null;
 update public.capacities c set demo_epoch=1
 from public.telematics_positions p
 join public.telematics_devices d on d.id=p.device_id
 join public.telematics_device_assignments a on a.id=p.assignment_id
  and a.device_id=d.id and a.vehicle_id=p.vehicle_id and a.ended_at is null
 where c.vehicle_id=p.vehicle_id and c.location_source='TELEMATICS'
  and c.location_updated_at=p.observed_at
  and c.location_lat=(public.telematics_obscure(p.latitude,p.longitude,c.location_precision_km)->>'latitude')::double precision
  and c.location_lng=(public.telematics_obscure(p.latitude,p.longitude,c.location_precision_km)->>'longitude')::double precision
  and p.valid and p.demo_epoch=1 and c.demo_epoch is null
  and d.imei='990000000000013' and d.synthetic and d.model_profile='SYNTHETIC_GT06'
  and d.organization_id='6727b198-d771-436a-9f1f-7bf27b8cea2f';
end $backfill$;
commit;
