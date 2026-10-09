begin;
do $test$
<<fixture>>
declare owner_id uuid;driver_id uuid;truck_id uuid;shipment_id uuid:=gen_random_uuid();
 route_points jsonb;command jsonb;proof jsonb;data jsonb;recipient_id uuid;completed_event uuid;
 digest_owner text:=repeat('c',64);event_count bigint;proof_count bigint;
begin
 select m.user_id,d.user_id into strict owner_id,driver_id
 from organization_members m join drivers d on d.organization_id=m.organization_id and d.active
 join profiles p on p.id=d.user_id and p.active join lateral provider_capacity_actor_scope(m.user_id) a on a.workspace_access
 where m.membership_role='OWNER' limit 1;
 truck_id:=(create_provider_vehicle(owner_id,'{"make":"Retention audit","model":"Test","plate":"AUDIT-APPROVAL-RETENTION","cargo_configuration":"Mini Box Truck"}')->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_tracking',true,'can_manage_capacity',true));
 select current_route_points_json into strict route_points from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 command:=jsonb_build_object('vehicle_id',truck_id,'id',shipment_id,'code','LGX-'||upper(substr(replace(shipment_id::text,'-',''),1,8)),
 'origin_place_ref',route_points->0->>'place_ref','destination_place_ref',route_points->1->>'place_ref','cargo_summary','Synthetic retention regression',
 'customer_email','retention-owner@example.invalid','customer_email_digest',digest_owner,'additional_recipients','[]'::jsonb,
 'expected_delivery_date',(current_date+2)::text,'tracking_mode','STATUS_ONLY','tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex'));
 perform create_provider_tracking_with_recipients(owner_id,command);
 proof:='{"path":"supabase://shipment-proof/synthetic-retention.jpg","original_name":"proof.jpg","mime_type":"image/jpeg"}';
 perform update_provider_tracking_status(driver_id,shipment_id,jsonb_build_object('next_status','LOADING','proof',proof));
 perform update_provider_tracking_status(driver_id,shipment_id,'{"next_status":"IN_TRANSIT"}');
 perform update_provider_tracking_status(driver_id,shipment_id,jsonb_build_object('next_status','UNLOADING','proof',proof));
 data:=approve_provider_handover(shipment_id,digest_owner,clock_timestamp());
 if data->>'approved'<>'true' then raise exception 'OWNER_APPROVAL_FAILED';end if;
 select e.id,e.approved_by_recipient_id into strict completed_event,recipient_id from provider_shipment_events e
 where e.shipment_id=fixture.shipment_id and e.status='COMPLETED';
 select count(*),count(e.proof_storage_path) into event_count,proof_count from provider_shipment_events e where e.shipment_id=fixture.shipment_id;
 update provider_shipments s set guest_expires_at=clock_timestamp()-interval '1 day' where s.id=fixture.shipment_id;
 data:=provider_tracking_guest_cleanup(500);
 if exists(select 1 from provider_tracking_recipients r where r.shipment_id=fixture.shipment_id)
 or exists(select 1 from provider_tracking_email_otps o where o.shipment_id=fixture.shipment_id)
 then raise exception 'EXPIRED_CONTACT_DATA_RETAINED';end if;
 if not exists(select 1 from provider_shipment_events e where e.id=completed_event and e.handover_approval_kind='OWNER' and e.approved_by_recipient_id is null and e.created_by is null)
 then raise exception 'APPROVAL_HISTORY_LOST';end if;
 if not exists(select 1 from provider_shipments s where s.id=fixture.shipment_id and s.operational_status='COMPLETED' and s.handover_approval_kind='OWNER' and s.handover_approved_at is not null)
 then raise exception 'COMPLETION_LOST';end if;
 if (select count(*) from provider_shipment_events e where e.shipment_id=fixture.shipment_id)<>event_count
 or (select count(e.proof_storage_path) from provider_shipment_events e where e.shipment_id=fixture.shipment_id)<>proof_count
 then raise exception 'PROOF_OR_TIMELINE_DELETED';end if;
 if provider_guest_tracking_for_recipient(shipment_id,digest_owner) is not null then raise exception 'EXPIRED_GUEST_ACCESS_REOPENED';end if;
 begin
  insert into provider_shipment_events(shipment_id,status,event_type,note) values(shipment_id,'IN_TRANSIT','STATUS','Invalid actorless fixture');
  raise exception 'ACTORLESS_EVENT_ALLOWED';
 exception when check_violation then null;end;
 begin
  insert into provider_shipment_events(shipment_id,status,event_type,note) values(shipment_id,'COMPLETED','STATUS','Invalid unmarked completion fixture');
  raise exception 'NULL_APPROVAL_MARKER_ALLOWED';
 exception when check_violation then null;end;
 if has_table_privilege('anon','provider_shipment_events','SELECT,INSERT,UPDATE,DELETE')
 or has_function_privilege('authenticated','public.complete_provider_handover(uuid,uuid,text,uuid)','EXECUTE')
 then raise exception 'RETENTION_AUTHORITY_BROADENED';end if;
end $test$;
rollback;
