-- FEAT-GPS-001. Disposable clone only; every device, assignment and source write rolls back.
begin;
do $test$
declare
 administrator uuid; provider uuid; foreign_provider uuid;
 gateway uuid; device uuid; owner_org constant uuid:='6727b198-d771-436a-9f1f-7bf27b8cea2f';
 truck constant uuid:='76bea7fa-03b2-42f0-af51-fff05c62cbc7';
 result jsonb; row jsonb; revision text; denied boolean:=false;
begin
 if current_database()<>'loadgistic_demo_gps_admin_ci' then raise exception 'DISPOSABLE_CLONE_REQUIRED';end if;
 select u.id into administrator from auth.users u join profiles p on p.id=u.id and p.active and p.role='ADMIN'
  where u.raw_app_meta_data->>'fixture_source'='loadgistic' and u.raw_user_meta_data->>'fixture_key'='user-admin';
 select m.user_id into provider from organization_members m join auth.users u on u.id=m.user_id
  where m.organization_id=owner_org and m.membership_role='OWNER' and u.raw_app_meta_data->>'fixture_source'='loadgistic'
   and u.raw_user_meta_data->>'fixture_key'='user-transporter';
 select m.user_id into foreign_provider from demo_motion_fleet_allowlist f join organization_members m
  on m.organization_id=f.organization_id and m.membership_role='OWNER' where f.imei='990000000000005';
 select id into gateway from telematics_gateways where active and synthetic_only;
 if administrator is null or provider is null or foreign_provider is null or gateway is null
  or not exists(select 1 from vehicles where id=truck and organization_id=owner_org and active)
  or exists(select 1 from telematics_devices where imei='990000000000013')
  or exists(select 1 from telematics_device_assignments where vehicle_id=truck and ended_at is null)
  then raise exception 'SPARE_FIXTURE_PRECONDITION_FAILED';end if;
 result:=provision_telematics_device(administrator,jsonb_build_object(
  'gatewayId',gateway,'gatewayDeviceId',9013,'imei','990000000000013',
  'protocol','gt06','protocolDeviceId','990000000000013','ownerOrganizationId',owner_org,
  'label','Demo GPS for Truck 02','synthetic',true,'modelProfile','SYNTHETIC_GT06'));
 device:=(result->>'id')::uuid;revision:=result->>'revision';
 if device is null or not exists(select 1 from telematics_devices where id=device and organization_id=owner_org
  and provider_profile_id is null and synthetic and model_profile='SYNTHETIC_GT06') then raise exception 'ADMIN_LINK_SCOPE_FAILED';end if;
 select item into row from jsonb_array_elements(telematics_workspace(provider,1)->'devices') item where item->>'id'=device::text;
 if row is null or row->>'connection'<>'UNKNOWN' or row->'position'<>'null'::jsonb
  or row->>'vehicleId' is not null then raise exception 'PROVIDER_UNASSIGNED_READBACK_FAILED';end if;
 if exists(select 1 from jsonb_array_elements(telematics_workspace(foreign_provider,1)->'devices') item
  where item->>'id'=device::text) then raise exception 'FOREIGN_PROVIDER_DEVICE_VISIBLE';end if;
 begin
  perform assign_telematics_device(foreign_provider,jsonb_build_object('deviceId',device,'vehicleId',truck,'expectedRevision',revision));
 exception when others then denied:=sqlerrm='NOT_FOUND';end;
 if not denied then raise exception 'FOREIGN_PROVIDER_ASSIGNMENT_ALLOWED';end if;
 result:=assign_telematics_device(provider,jsonb_build_object('deviceId',device,'vehicleId',truck,'expectedRevision',revision));
 revision:=result->>'revision';
 select item into row from jsonb_array_elements(telematics_workspace(provider,1)->'devices') item where item->>'id'=device::text;
 if row->>'vehicleId' is distinct from truck::text then raise exception 'PROVIDER_ASSIGNMENT_NOT_VISIBLE';end if;
 result:=assign_telematics_device(provider,jsonb_build_object('deviceId',device,'expectedRevision',revision));
 revision:=result->>'revision';
 if exists(select 1 from telematics_device_assignments where device_id=device and ended_at is null)
  then raise exception 'SPARE_DETACH_FAILED';end if;
 result:=assign_telematics_device(provider,jsonb_build_object('deviceId',device,'vehicleId',truck,'expectedRevision',revision));
 if (select count(*) from telematics_device_assignments where device_id=device and ended_at is not null)<>1
  or (select count(*) from telematics_device_assignments where device_id=device and vehicle_id=truck and ended_at is null)<>1
  then raise exception 'SPARE_REASSIGN_HISTORY_FAILED';end if;
 if (select count(*) from telematics_device_assignments where vehicle_id='caf1d0db-4d8e-4ce9-a879-6c7b6017de3a' and ended_at is null)<>1
  then raise exception 'MOVING_DEMO_DEVICE_CHANGED';end if;
end $test$;
rollback;
