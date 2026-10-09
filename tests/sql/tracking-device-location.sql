begin;
do $test$
<<fixture>>
declare owner_id uuid;driver_id uuid;other_driver uuid;org_id uuid;truck_id uuid;shipment_id uuid;device_id uuid:=gen_random_uuid();
 route_points jsonb;command jsonb;data jsonb;token_digest text:=encode(gen_random_bytes(32),'hex');rotated text:=encode(gen_random_bytes(32),'hex');
begin
 select m.user_id,m.organization_id,d.user_id into strict owner_id,org_id,driver_id
 from organization_members m join drivers d on d.organization_id=m.organization_id and d.active
 join profiles p on p.id=d.user_id and p.active join lateral provider_capacity_actor_scope(m.user_id) a on a.workspace_access
 where m.membership_role='OWNER' limit 1;
 select id into strict other_driver from profiles where role='DRIVER' and active and id<>driver_id limit 1;
 data:=create_provider_vehicle(owner_id,'{"make":"Device audit","model":"Test","plate":"AUDIT-DEVICE-LOCATION","cargo_configuration":"Mini Box Truck"}');truck_id:=(data->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',true,'can_manage_tracking',true));
 select current_route_points_json into strict route_points from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 shipment_id:=gen_random_uuid();
 perform create_provider_tracking_with_recipients(owner_id,jsonb_build_object('id',shipment_id,'code','LGX-'||upper(substr(replace(shipment_id::text,'-',''),1,8)),
 'vehicle_id',truck_id,'origin_place_ref',route_points->0->>'place_ref','destination_place_ref',route_points->1->>'place_ref','cargo_summary','Synthetic background device regression',
 'customer_email','background-owner@example.invalid','customer_email_digest',encode(gen_random_bytes(32),'hex'),'additional_recipients','[]'::jsonb,
 'expected_delivery_date',(current_date+2)::text,'tracking_mode','LOCATION_AND_STATUS','tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex')));
 begin perform issue_tracking_device_lease(other_driver,shipment_id,device_id,token_digest,20);raise exception 'FOREIGN_DEVICE_LEASE';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 begin perform issue_tracking_device_lease(owner_id,shipment_id,device_id,token_digest,20);raise exception 'OWNER_DEVICE_LEASE';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 begin perform issue_tracking_device_lease(driver_id,shipment_id,device_id,token_digest,40);raise exception 'WIDE_DEVICE_LEASE';exception when raise_exception then if sqlerrm<>'INVALID_TRACKING_DEVICE' then raise;end if;end;
 data:=issue_tracking_device_lease(driver_id,shipment_id,device_id,token_digest,20);
 if data->>'shipmentId'<>shipment_id::text or data->>'radius'<>'20' or data ? 'recipient_email' then raise exception 'DEVICE_LEASE_RESPONSE';end if;
 command:=jsonb_build_object('lat',41.8781,'lng',-87.6298,'area','Around current device area','precision_km',20,'source','DEVICE_OBSCURED','observed_at',clock_timestamp());
 data:=report_tracking_device_location(token_digest,command);if data->>'recorded'<>'true' then raise exception 'DEVICE_FIX_NOT_SAVED';end if;
 if not exists(select 1 from provider_shipment_events where provider_shipment_events.shipment_id=fixture.shipment_id and location_lat=41.8781 and location_lng=-87.6298 and created_by=driver_id) then raise exception 'DEVICE_FIX_ACTOR';end if;
 data:=report_tracking_device_location(token_digest,command);if data->>'reason'<>'THROTTLED' then raise exception 'DEVICE_CADENCE_BYPASS';end if;
 begin perform report_tracking_device_location(token_digest,command||jsonb_build_object('observed_at',clock_timestamp()-interval '3 minutes'));raise exception 'STALE_DEVICE_FIX';exception when raise_exception then if sqlerrm<>'INVALID_TRACKING_DEVICE_LOCATION' then raise;end if;end;
 begin perform report_tracking_device_location(token_digest,command||'{"precision_km":10}');raise exception 'UNREVIEWED_DEVICE_PRECISION';exception when raise_exception then if sqlerrm<>'INVALID_TRACKING_DEVICE_LOCATION' then raise;end if;end;
 perform issue_tracking_device_lease(driver_id,shipment_id,device_id,rotated,20);
 begin perform report_tracking_device_location(token_digest,command);raise exception 'ROTATED_DEVICE_TOKEN';exception when raise_exception then if sqlerrm<>'TRACKING_DEVICE_UNAVAILABLE' then raise;end if;end;
 update tracking_device_leases set expires_at=clock_timestamp()-interval '1 second' where tracking_device_leases.token_digest=fixture.rotated;
 begin perform report_tracking_device_location(rotated,command);raise exception 'EXPIRED_DEVICE_TOKEN';exception when raise_exception then if sqlerrm<>'TRACKING_DEVICE_UNAVAILABLE' then raise;end if;end;
 perform issue_tracking_device_lease(driver_id,shipment_id,device_id,rotated,20);
 perform revoke_tracking_device_lease(rotated);
 begin perform report_tracking_device_location(rotated,command);raise exception 'LOGGED_OUT_DEVICE_TOKEN';exception when raise_exception then if sqlerrm<>'TRACKING_DEVICE_UNAVAILABLE' then raise;end if;end;
 perform issue_tracking_device_lease(driver_id,shipment_id,device_id,rotated,20);
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',true,'can_manage_tracking',false));
 begin perform report_tracking_device_location(rotated,command);raise exception 'REVOKED_TRACKING_PERMISSION';exception when raise_exception then if sqlerrm<>'TRACKING_DEVICE_UNAVAILABLE' then raise;end if;end;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',true,'can_manage_tracking',true));
 update profiles set active=false where id=driver_id;
 begin perform report_tracking_device_location(rotated,command);raise exception 'INACTIVE_DRIVER_DEVICE';exception when raise_exception then if sqlerrm<>'TRACKING_DEVICE_UNAVAILABLE' then raise;end if;end;
 update profiles set active=true where id=driver_id;
 update provider_shipments set operational_status='CANCELLED' where id=fixture.shipment_id;
 if not exists(select 1 from tracking_device_leases where tracking_device_leases.token_digest=fixture.rotated and revoked_at is not null) then raise exception 'TERMINAL_DEVICE_NOT_REVOKED';end if;
 begin perform report_tracking_device_location(rotated,command);raise exception 'TERMINAL_DEVICE_REPORT';exception when raise_exception then if sqlerrm<>'TRACKING_DEVICE_UNAVAILABLE' then raise;end if;end;
 if has_table_privilege('authenticated','tracking_device_leases','SELECT') or has_table_privilege('anon','tracking_device_leases','SELECT')
 or has_function_privilege('authenticated','issue_tracking_device_lease(uuid,uuid,uuid,text,integer)','EXECUTE')
 or has_function_privilege('anon','report_tracking_device_location(text,jsonb)','EXECUTE')
 or not(select relrowsecurity from pg_class where oid='tracking_device_leases'::regclass) then raise exception 'DEVICE_BROWSER_ACCESS';end if;
 raise notice 'PASS: shipment-scoped device issue/report, global offset input, cadence, stale/precision denial, rotation, expiry, logout, permission, inactive account, terminal revocation and RLS';
end $test$;
rollback;
