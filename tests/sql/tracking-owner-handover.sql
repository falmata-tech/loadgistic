begin;
do $test$
<<fixture>>
declare owner_id uuid;driver_id uuid;other_driver uuid;org_id uuid;truck_id uuid;shipment_id uuid;admin_id uuid;
 route_points jsonb;command jsonb;proof jsonb;data jsonb;appeal_id uuid;recipient_id uuid;before_count integer;mode_value text;
 digest_owner text:=repeat('a',64);digest_viewer text:=repeat('b',64);
begin
 select m.user_id,m.organization_id,d.user_id into strict owner_id,org_id,driver_id
 from organization_members m join drivers d on d.organization_id=m.organization_id and d.active
 join profiles p on p.id=d.user_id and p.active join lateral provider_capacity_actor_scope(m.user_id) a on a.workspace_access
 where m.membership_role='OWNER' limit 1;
 select id into strict other_driver from profiles where role='DRIVER' and active and id<>driver_id limit 1;
 select id into strict admin_id from profiles where role='ADMIN' and active limit 1;
 data:=create_provider_vehicle(owner_id,'{"make":"Handover audit","model":"Test","plate":"AUDIT-TRACKING-HANDOVER","cargo_configuration":"Mini Box Truck"}');truck_id:=(data->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',true,'can_manage_tracking',true));
 select current_route_points_json into strict route_points from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 command:=jsonb_build_object('vehicle_id',truck_id,'origin_place_ref',route_points->0->>'place_ref','destination_place_ref',route_points->1->>'place_ref','cargo_summary','Synthetic handover regression',
 'customer_email','handover-owner@example.invalid','customer_email_digest',digest_owner,'additional_recipients',jsonb_build_array(jsonb_build_object('email','handover-viewer@example.invalid','digest',digest_viewer)),
 'expected_delivery_date',(current_date+2)::text,'tracking_mode','LOCATION_AND_STATUS','tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex'));
 proof:='{"path":"supabase://shipment-proof/synthetic-handover.jpg","original_name":"proof.jpg","mime_type":"image/jpeg"}';
 foreach mode_value in array array['OWNER','STAFF','RELEASED','DISMISSED'] loop
  shipment_id:=gen_random_uuid();perform create_provider_tracking_with_recipients(owner_id,command||jsonb_build_object('tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex'),'id',shipment_id,'code','LGX-'||upper(substr(replace(shipment_id::text,'-',''),1,8))));
  -- Mode is immutable even through direct owner/service update paths.
  begin update provider_shipments set tracking_mode='STATUS_ONLY' where id=shipment_id;raise exception 'TRACKING_MODE_MUTABLE';exception when raise_exception then if sqlerrm<>'TRACKING_MODE_LOCKED' then raise;end if;end;
  data:=update_provider_tracking_location(driver_id,shipment_id,'{"area":"Around current device area","lat":41,"lng":-87,"precision_km":20,"source":"DEVICE_OBSCURED"}');
  if data->>'recorded'<>'true' then raise exception 'INITIAL_AUTO_LOCATION_MISSING';end if;
  begin perform update_provider_tracking_location(driver_id,shipment_id,'{"area":"Around current device area","lat":41,"lng":-87,"precision_km":40,"source":"DEVICE_OBSCURED"}');raise exception 'WIDE_TRACKING_RADIUS_ALLOWED';exception when raise_exception then if sqlerrm<>'TRACKING_DEVICE_LOCATION_REQUIRED' then raise;end if;end;
  begin perform update_provider_tracking_location(driver_id,shipment_id,'{"area":"Around current device area","lat":null,"lng":-87,"precision_km":20,"source":"DEVICE_OBSCURED"}');raise exception 'NULL_TRACKING_FIX_ALLOWED';exception when raise_exception then if sqlerrm<>'TRACKING_DEVICE_LOCATION_REQUIRED' then raise;end if;end;
  begin perform update_provider_tracking_status(driver_id,shipment_id,'{"next_status":"LOADING"}');raise exception 'LOADING_WITHOUT_PROOF';exception when raise_exception then if sqlerrm<>'TRACKING_HANDOVER_PROOF_REQUIRED' then raise;end if;end;
  perform update_provider_tracking_status(driver_id,shipment_id,jsonb_build_object('next_status','LOADING','proof',proof));
  perform update_provider_tracking_status(driver_id,shipment_id,jsonb_build_object('next_status','IN_TRANSIT','location','{"area":"Around current device area","lat":41,"lng":-87,"precision_km":20,"source":"DEVICE_OBSCURED"}'::jsonb));
  begin perform update_provider_tracking_status(driver_id,shipment_id,'{"next_status":"UNLOADING"}');raise exception 'UNLOADING_WITHOUT_PROOF';exception when raise_exception then if sqlerrm<>'TRACKING_HANDOVER_PROOF_REQUIRED' then raise;end if;end;
  perform update_provider_tracking_status(driver_id,shipment_id,jsonb_build_object('next_status','UNLOADING','proof',proof));
  begin perform update_provider_tracking_status(driver_id,shipment_id,'{"next_status":"COMPLETED"}');raise exception 'DRIVER_SELF_COMPLETED';exception when raise_exception then if sqlerrm<>'TRACKING_OWNER_APPROVAL_REQUIRED' then raise;end if;end;
  data:=provider_guest_tracking_for_recipient(shipment_id,digest_owner);
  if data->>'can_approve'<>'true' or data->'current_location'='null'::jsonb then raise exception 'OWNER_APPROVAL_OR_WAITING_LOCATION_MISSING';end if;
  data:=provider_guest_tracking_for_recipient(shipment_id,digest_viewer);
  if data->>'can_approve'<>'false' then raise exception 'VIEWER_APPROVAL_ADVERTISED';end if;
  begin perform approve_provider_handover(shipment_id,digest_viewer,clock_timestamp());raise exception 'VIEWER_APPROVED';exception when raise_exception then if sqlerrm<>'TRACKING_APPROVAL_FORBIDDEN' then raise;end if;end;
  begin perform approve_provider_handover(shipment_id,digest_owner,clock_timestamp()-interval '5 minutes');raise exception 'EXPIRED_OWNER_APPROVED';exception when raise_exception then if sqlerrm<>'TRACKING_SESSION_EXPIRED' then raise;end if;end;
  begin perform approve_provider_handover(shipment_id,digest_owner,null);raise exception 'MISSING_SESSION_APPROVED';exception when raise_exception then if sqlerrm<>'TRACKING_SESSION_EXPIRED' then raise;end if;end;
  begin perform approve_provider_handover(shipment_id,digest_owner,clock_timestamp()+interval '1 minute');raise exception 'FUTURE_SESSION_APPROVED';exception when raise_exception then if sqlerrm<>'TRACKING_SESSION_EXPIRED' then raise;end if;end;
  begin perform submit_provider_tracking_appeal(other_driver,shipment_id,'Unrelated driver appeal');raise exception 'FOREIGN_DRIVER_APPEALED';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
  appeal_id:=submit_provider_tracking_appeal(driver_id,shipment_id,'Waiting for shipment owner to approve unloading');
  if submit_provider_tracking_appeal(driver_id,shipment_id,'Repeated submission')<>appeal_id then raise exception 'DUPLICATE_OPEN_APPEAL';end if;
  begin perform resolve_provider_tracking_appeal(owner_id,appeal_id,'APPROVED','Owner acting as staff');raise exception 'PROVIDER_STAFF_RESOLUTION';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  begin perform resolve_provider_tracking_appeal(admin_id,appeal_id,'APPROVED','');raise exception 'STAFF_UNEXPLAINED_RELEASE';exception when raise_exception then if sqlerrm<>'TRACKING_INVESTIGATION_REQUIRED' then raise;end if;end;
  if mode_value='OWNER' then
   data:=approve_provider_handover(shipment_id,digest_owner,clock_timestamp());if data->>'approved'<>'true' then raise exception 'OWNER_APPROVAL_FAILED';end if;
   select count(*) into before_count from provider_shipment_events where provider_shipment_events.shipment_id=fixture.shipment_id;
   data:=approve_provider_handover(shipment_id,digest_owner,clock_timestamp());
   if data->>'alreadyApproved'<>'true' or (select count(*) from provider_shipment_events where provider_shipment_events.shipment_id=fixture.shipment_id)<>before_count then raise exception 'APPROVAL_REPLAY_NOT_IDEMPOTENT';end if;
  else perform resolve_provider_tracking_appeal(admin_id,appeal_id,case mode_value when 'STAFF' then 'APPROVED' else mode_value end,'Investigated phone confirmation and retained shipment proof');end if;
  if mode_value in ('OWNER','STAFF') then
   if not exists(select 1 from provider_shipments where id=shipment_id and operational_status='COMPLETED' and handover_approved_at is not null and handover_approval_kind=mode_value) then raise exception 'HANDOVER_RESULT_NOT_SAVED';end if;
   if (select count(*) from email_deliveries where email_deliveries.shipment_id=fixture.shipment_id and delivery_kind='COMPLETION')<>1 then raise exception 'COMPLETION_OUTBOX_NOT_ONCE';end if;
  elsif mode_value='RELEASED' then if not exists(select 1 from provider_shipments where id=shipment_id and operational_status='CANCELLED' and handover_approved_at is null) then raise exception 'STAFF_RELEASE_FALSE_APPROVAL';end if;
  else if not exists(select 1 from provider_shipments where id=shipment_id and operational_status='UNLOADING') then raise exception 'DISMISSED_APPEAL_CLOSED_TRACKING';end if;end if;
  if mode_value<>'DISMISSED' then begin perform update_provider_tracking_location(driver_id,shipment_id,'{"area":"Around current device area","lat":41,"lng":-87,"precision_km":20,"source":"DEVICE_OBSCURED"}');raise exception 'TERMINAL_TRACKING_CONTINUED';exception when raise_exception then if sqlerrm<>'TRACKING_LOCATION_NOT_ENABLED' then raise;end if;end;end if;
 end loop;
 if has_function_privilege('service_role','complete_provider_handover(uuid,uuid,text,uuid)','EXECUTE') or has_function_privilege('authenticated','approve_provider_handover(uuid,text,timestamptz)','EXECUTE')
  or has_table_privilege('anon','provider_tracking_appeals','SELECT') or not(select relrowsecurity from pg_class where oid='provider_tracking_appeals'::regclass) then raise exception 'HANDOVER_BROWSER_BYPASS';end if;
 raise notice 'PASS: required proofs, immutable mode, world/20-km location, fresh owner approval, replay, appeals and audited staff decisions';
end $test$;
rollback;
