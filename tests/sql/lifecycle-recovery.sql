begin;
create function pg_temp.expect_lifecycle_denied(command text,expected text) returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;raise exception 'EXPECTED_DENIAL';end $$;
do $test$
declare owner_id uuid; outsider uuid; staff uuid; admin_id uuid; company_driver uuid; a uuid; b uuid; shipment uuid:=gen_random_uuid();
 origin_ref text; destination_ref text; provider uuid; revision text; result jsonb; command jsonb; n integer; role_name text; signature text;
begin
 select id into strict owner_id from profiles where email='driver@loadgistic.local';
 select id into strict outsider from profiles where email='transporter@loadgistic.local';
 select id into strict company_driver from profiles where email='company-driver@loadgistic.local';
 select id into strict staff from profiles where email='support@loadgistic.local';
 select id into strict admin_id from profiles where email='admin@loadgistic.local';
 select id into strict provider from provider_profiles where user_id=owner_id;
 select id into origin_ref from place_catalog where normalized_name='addis ababa' limit 1;
 select id into destination_ref from place_catalog where normalized_name='adama' limit 1;
 a:=(create_provider_vehicle(owner_id,jsonb_build_object('make','Toyota','model','Lifecycle A','plate','TEST-A','cargo_configuration','Pickup truck','trailer_interchangeable',false))->>'id')::uuid;
 b:=(create_provider_vehicle(owner_id,jsonb_build_object('make','Toyota','model','Lifecycle B','plate','TEST-B','cargo_configuration','Pickup truck','trailer_interchangeable',false))->>'id')::uuid;
 if a is null or b is null then raise exception 'VEHICLE_CREATE_FAILED';end if;
 perform create_provider_tracking_with_recipients(owner_id,jsonb_build_object('id',shipment,'code','LGX-'||upper(substr(replace(shipment::text,'-',''),1,8)),
 'vehicle_id',a,'origin_place_ref',origin_ref,'destination_place_ref',destination_ref,'cargo_summary','Synthetic lifecycle cargo',
 'customer_email','lifecycle-sql@example.test','customer_email_digest',repeat('1',64),'additional_recipients','[]'::jsonb,
 'tracking_mode','LOCATION_AND_STATUS','tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex')));
 perform pg_temp.expect_lifecycle_denied(format('select set_vehicle_lifecycle(%L,%L,false,%L)',owner_id,a,'Retire active truck'),'TRUCK_HAS_ACTIVE_TRACKING');
 perform pg_temp.expect_lifecycle_denied(format('select set_vehicle_lifecycle(%L,%L,false,%L)',outsider,b,'Wrong owner retirement'),'NOT_FOUND');
 perform pg_temp.expect_lifecycle_denied(format('select set_vehicle_lifecycle(%L,%L,false,%L)',company_driver,b,'Driver retirement'),'NOT_FOUND');
 revision:=(tracking_recovery_context(owner_id,shipment)->>'revision');
 command:=jsonb_build_object('action','CORRECT','revision',revision,'reason','Correct customer instructions','cargo_summary','Corrected cargo',
  'origin_place_ref',origin_ref,'destination_place_ref',destination_ref,'expected_pickup_date','2026-09-14','expected_delivery_date','2026-09-15');
 perform pg_temp.expect_lifecycle_denied(format('select recover_provider_tracking(%L,%L,%L)',outsider,shipment,command),'NOT_FOUND');
 perform pg_temp.expect_lifecycle_denied(format('select recover_provider_tracking(%L,%L,%L)',company_driver,shipment,command),'NOT_FOUND');
 perform recover_provider_tracking(owner_id,shipment,command);
 perform pg_temp.expect_lifecycle_denied(format('select recover_provider_tracking(%L,%L,%L)',owner_id,shipment,command),'TRACKING_CHANGED');
 if (select cargo_summary from provider_shipments where id=shipment)<>'Corrected cargo' then raise exception 'CORRECTION_NOT_SAVED';end if;
 if (select count(*) from provider_tracking_recoveries where shipment_id=shipment)<>1 then raise exception 'RECOVERY_HISTORY_MISSING';end if;
 update provider_shipments set operational_status='IN_TRANSIT' where id=shipment;
 insert into provider_shipment_events(shipment_id,status,event_type,note,created_by,location_area,location_lat,location_lng,location_precision_km,location_source,created_at)
 values(shipment,'IN_TRANSIT','LOCATION','Before reassignment',owner_id,'Around test',9,39,20,'DEVICE_OBSCURED',now()-interval '1 minute');
 if admin_tracking_location(admin_id,shipment) is null then raise exception 'ADMIN_MAP_MISSING';end if;
 update support_agent_profiles set can_manage_operations=false where user_id=staff;
 perform pg_temp.expect_lifecycle_denied(format('select admin_tracking_location(%L,%L)',staff,shipment),'FORBIDDEN');
 if tracking_recovery_context(staff,shipment) is not null then raise exception 'UNAUTHORIZED_RECOVERY_CONTEXT';end if;
 command:=jsonb_build_object('action','REASSIGN','vehicle_id',(select platform_number from vehicles where id=b),'revision',(tracking_recovery_context(owner_id,shipment)->>'revision'),'reason','Change the operating truck');
 perform recover_provider_tracking(admin_id,shipment,command);
 if admin_tracking_location(admin_id,shipment) is not null or provider_guest_tracking_for_recipient(shipment,repeat('1',64))->'current_location'<>'null'::jsonb then raise exception 'STALE_LOCATION_VISIBLE';end if;
 if (select count(*) from provider_shipment_events where shipment_id=shipment and location_source='DEVICE_OBSCURED')<>1 then raise exception 'LOCATION_HISTORY_DELETED';end if;
 perform set_vehicle_lifecycle(owner_id,a,false,'No longer operating this truck');
 if (retired_provider_vehicle_page(owner_id,0,10)->>'total')::integer<1 then raise exception 'RETIRED_TRUCK_HIDDEN_FROM_OWNER';end if;
 perform set_vehicle_lifecycle(owner_id,a,true,'Return the truck to service');
 if (select coalesce(market_status,status::text) from capacities where vehicle_id=a order by updated_at desc,id desc limit 1)<>'OFF_DUTY' then raise exception 'HISTORICAL_CAPACITY_REPUBLISHED';end if;
 command:=jsonb_build_object('action','CANCEL','revision',(tracking_recovery_context(owner_id,shipment)->>'revision'),'reason','The agreed work was cancelled','confirm','CANCEL');
 perform recover_provider_tracking(owner_id,shipment,command);
 if provider_guest_tracking_for_recipient(shipment,repeat('1',64)) is not null then raise exception 'CANCELLED_GUEST_ACCESS';end if;
 if exists(select 1 from provider_tracking_recipients where shipment_id=shipment and revoked_at is null) then raise exception 'RECIPIENT_NOT_REVOKED';end if;
 if exists(select 1 from email_deliveries where shipment_id=shipment and delivery_kind='COMPLETION') then raise exception 'CANCELLATION_COMPLETION_EMAIL';end if;
 perform pg_temp.expect_lifecycle_denied(format('select recover_provider_tracking(%L,%L,%L)',admin_id,shipment,command),'TRACKING_TERMINAL');
 perform set_vehicle_lifecycle(owner_id,b,false,'Retire after cancelled work');
 -- Bounded workspace correction repeats authority and catches lost updates.
 select business_name into revision from provider_profiles where id=provider;
 command:=jsonb_build_object('kind','PROVIDER_PROFILE','name','Corrected test business','previous_name',revision,'reason','Correct the public business name');
 perform pg_temp.expect_lifecycle_denied(format('select correct_admin_workspace(%L,%L,%L)',owner_id,provider,command),'FORBIDDEN');
 perform correct_admin_workspace(admin_id,provider,command);
 perform pg_temp.expect_lifecycle_denied(format('select correct_admin_workspace(%L,%L,%L)',admin_id,provider,command),'WORKSPACE_CHANGED');
 foreach role_name in array array['anon','authenticated'] loop
  foreach signature in array array['lifecycle_actor_can_manage(uuid,uuid,uuid)','set_vehicle_lifecycle(uuid,uuid,boolean,text)','retired_provider_vehicle_page(uuid,integer,integer)','tracking_recovery_context(uuid,uuid)','recover_provider_tracking(uuid,uuid,jsonb)','correct_admin_workspace(uuid,uuid,jsonb)','admin_tracking_location(uuid,uuid)'] loop
   if has_function_privilege(role_name,'public.'||signature,'EXECUTE') then raise exception 'DIRECT_LIFECYCLE_RPC';end if;
  end loop;
  if has_table_privilege(role_name,'public.provider_tracking_recoveries','SELECT,INSERT,UPDATE,DELETE') then raise exception 'DIRECT_RECOVERY_TABLE';end if;
 end loop;
 raise notice 'Lifecycle owner/Operations scope, revision, history, retirement, cancellation and map checks passed';
end $test$;
rollback;
