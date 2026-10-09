begin;
do $test$
<<fixture>>
declare owner_id uuid;driver_id uuid;other_driver uuid;org_id uuid;truck_id uuid;shipment_id uuid;
 route_points jsonb;command jsonb;proof jsonb;data jsonb;stamp timestamptz;seen_stamp timestamptz;
 push_session uuid:=gen_random_uuid();push_device uuid:=gen_random_uuid();push_worker uuid:=gen_random_uuid();push_delivery uuid;
begin
 select m.user_id,m.organization_id,d.user_id into strict owner_id,org_id,driver_id
 from organization_members m join drivers d on d.organization_id=m.organization_id and d.active
 join profiles p on p.id=d.user_id and p.active join lateral provider_capacity_actor_scope(m.user_id) a on a.workspace_access
 where m.membership_role='OWNER' limit 1;
 select id into strict other_driver from profiles where role='DRIVER' and active and id<>driver_id limit 1;
 data:=create_provider_vehicle(owner_id,'{"make":"Notification audit","model":"Test","plate":"AUDIT-HANDOVER-ALERT","cargo_configuration":"Mini Box Truck"}');truck_id:=(data->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',true,'can_manage_tracking',true));
 select current_route_points_json into strict route_points from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 shipment_id:=gen_random_uuid();command:=jsonb_build_object('vehicle_id',truck_id,'origin_place_ref',route_points->0->>'place_ref','destination_place_ref',route_points->1->>'place_ref','cargo_summary','Synthetic approval alert',
 'customer_email','notification-owner@example.invalid','customer_email_digest',repeat('d',64),'expected_delivery_date',(current_date+2)::text,'tracking_mode','STATUS_ONLY',
 'tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex'),'id',shipment_id,'code','LGX-'||upper(substr(replace(shipment_id::text,'-',''),1,8)));
 perform create_provider_tracking_with_recipients(owner_id,command);
 insert into auth.sessions(id,user_id,created_at,updated_at) values(push_session,driver_id,now(),now());
 perform register_native_push_binding(push_device,repeat('a',64),'ExpoPushToken[synthetic-handover-token]','en',driver_id,push_session,null,null);
 if exists(select 1 from native_push_outbox where source_id=shipment_id) then raise exception 'UNAPPROVED_PUSH';end if;
 data:=driver_handover_alert_snapshot(driver_id);
 if exists(select 1 from jsonb_array_elements(data->'items') i where i->>'id'=shipment_id::text) then raise exception 'UNAPPROVED_ALERT';end if;
 begin perform acknowledge_driver_handover_alert(driver_id,shipment_id,clock_timestamp());raise exception 'UNAPPROVED_ACK';exception when raise_exception then if sqlerrm<>'HANDOVER_ALERT_CHANGED' then raise;end if;end;
 proof:='{"path":"supabase://shipment-proof/synthetic-alert.jpg","original_name":"proof.jpg","mime_type":"image/jpeg"}';
 perform update_provider_tracking_status(driver_id,shipment_id,jsonb_build_object('next_status','LOADING','proof',proof));
 perform update_provider_tracking_status(driver_id,shipment_id,'{"next_status":"IN_TRANSIT"}');
 perform update_provider_tracking_status(driver_id,shipment_id,jsonb_build_object('next_status','UNLOADING','proof',proof));
 perform approve_provider_handover(shipment_id,repeat('d',64),clock_timestamp());
 select handover_approved_at into stamp from provider_shipments where id=shipment_id;
 select id into strict push_delivery from native_push_outbox where source_id=shipment_id and kind='HANDOVER' and event='APPROVED' and approved_at=stamp;
 update native_push_outbox set next_attempt_at=now()-interval '1 second' where id=push_delivery;
 perform claim_native_push_batch(push_worker,40);
 data:=native_push_delivery_context(push_delivery,push_worker);
 if data is null or data->>'kind'<>'HANDOVER' or data->>'event'<>'APPROVED' or data::text like '%notification-owner%' or data::text like '%proof%' then raise exception 'HANDOVER_PUSH_MISSING_OR_PRIVATE';end if;
 data:=driver_handover_alert_snapshot(driver_id);
 if not exists(select 1 from jsonb_array_elements(data->'items') i where i->>'id'=shipment_id::text and (i->>'unread')::boolean and i->>'approvalKind'='OWNER') then raise exception 'SAVED_APPROVAL_ALERT_MISSING';end if;
 if exists(select 1 from driver_handover_alert_reads where driver_handover_alert_reads.shipment_id=fixture.shipment_id) then raise exception 'FETCH_ACKNOWLEDGED';end if;
 if data::text like '%notification-owner%' or data::text like '%proof%' or data::text like '%cargo%' then raise exception 'ALERT_PRIVATE_DATA';end if;
 data:=driver_handover_alert_snapshot(other_driver);
 if exists(select 1 from jsonb_array_elements(data->'items') i where i->>'id'=shipment_id::text) then raise exception 'FOREIGN_FEED';end if;
 if driver_handover_alert_snapshot(owner_id)<>jsonb_build_object('unreadCount',0,'items','[]'::jsonb) then raise exception 'OWNER_DRIVER_FEED';end if;
 begin perform acknowledge_driver_handover_alert(other_driver,shipment_id,stamp);raise exception 'FOREIGN_ACK';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform acknowledge_driver_handover_alert(driver_id,shipment_id,stamp-interval '1 second');raise exception 'STALE_ACK';exception when raise_exception then if sqlerrm<>'HANDOVER_ALERT_CHANGED' then raise;end if;end;
 data:=acknowledge_driver_handover_alert(driver_id,shipment_id,stamp);
 if native_push_delivery_context(push_delivery,push_worker) is not null then raise exception 'ACKNOWLEDGED_HANDOVER_PUSH';end if;
 if exists(select 1 from jsonb_array_elements(data->'items') i where i->>'id'=shipment_id::text and (i->>'unread')::boolean) then raise exception 'ACK_UNREAD';end if;
 select seen_at into seen_stamp from driver_handover_alert_reads where driver_handover_alert_reads.shipment_id=fixture.shipment_id;
 perform acknowledge_driver_handover_alert(driver_id,shipment_id,stamp);
 if (select seen_at from driver_handover_alert_reads where driver_handover_alert_reads.shipment_id=fixture.shipment_id)<>seen_stamp then raise exception 'ACK_NOT_IDEMPOTENT';end if;
 update profiles set active=false where id=driver_id;
 begin perform driver_handover_alert_snapshot(driver_id);raise exception 'INACTIVE_FEED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform acknowledge_driver_handover_alert(driver_id,shipment_id,stamp);raise exception 'INACTIVE_ACK';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 update profiles set active=true where id=driver_id;
 update driver_permissions set can_manage_tracking=false where user_id=driver_id;
 data:=driver_handover_alert_snapshot(driver_id);
 if exists(select 1 from jsonb_array_elements(data->'items') i where i->>'id'=shipment_id::text) then raise exception 'REVOKED_DRIVER_FEED';end if;
 begin perform acknowledge_driver_handover_alert(driver_id,shipment_id,stamp);raise exception 'REVOKED_DRIVER_ACK';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 if has_table_privilege('anon','driver_handover_alert_reads','SELECT') or has_table_privilege('authenticated','driver_handover_alert_reads','INSERT')
 or has_function_privilege('authenticated','driver_handover_alert_snapshot(uuid)','EXECUTE')
 or has_function_privilege('anon','acknowledge_driver_handover_alert(uuid,uuid,timestamptz)','EXECUTE')
 or not(select relrowsecurity from pg_class where oid='driver_handover_alert_reads'::regclass) then raise exception 'BROWSER_ALERT_BYPASS';end if;
 raise notice 'PASS: real proof-backed owner completion, private scoped approval feed, fetch neutrality, stale/foreign/inactive/revoked denial and replay';
end $test$;
rollback;
