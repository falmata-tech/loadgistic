-- FEAT-TRK/ENT/SEC-001; own synthetic actors and stored report/proof metadata.
-- All writes roll back. This is not native-device or real-file delivery proof.
begin;
set local search_path=public,extensions,pg_temp;
create function pg_temp.session_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is not true then raise exception '%',label;end if;end$$;
-- Match the connected service-port wire contract against actual SQL output,
-- rather than filling required shipment fields only in mocked port fixtures.
create function pg_temp.session_wire_shipment(value jsonb)returns void language plpgsql as $$
declare saved_updated_at timestamptz;
begin
 perform pg_temp.session_assert(jsonb_typeof(value)='object'and not exists(
  select 1 from(values('id','string'),('code','string'),('operational_status','string'),('updated_at','string'),
   ('tracking_mode','string'),('can_view_location','boolean'),('events','array'))required(key,kind)
  where jsonb_typeof(value->required.key)is distinct from required.kind),'SESSION229_CONNECTED_WIRE_REQUIRED_FIELDS');
 select p.updated_at into saved_updated_at from public.provider_shipments p where p.id=(value->>'id')::uuid;
 perform pg_temp.session_assert(saved_updated_at is not null and(value->>'updated_at')::timestamptz=saved_updated_at,'SESSION229_CONNECTED_UPDATED_AT_NOT_SAVED_VALUE');
end$$;
-- Exact migration backfill body; a focused source check rejects copy drift.
create function pg_temp.session_history_backfill()returns void language plpgsql as $historybackfill229$
begin
 insert into public.tracking_sessions(reference,state,workspace_id,owner_user_id,created_by,origin_kind,shipment_id,route,cargo_summary,pickup_date,delivery_date,provider_location_consent)
 select p.code,'CONNECTED',c.business_workspace_id,c.owner_actor_id,c.owner_actor_id,'AUTHORIZED_SHIPMENT',p.id,route.points,p.cargo_summary,p.expected_pickup_date,p.expected_delivery_date,p.tracking_mode='LOCATION_AND_STATUS'
 from public.tracking_sharing_controls c join public.provider_shipments p on p.id=c.shipment_id
 join public.provider_tracking_recipients r on r.id=c.owner_recipient_id and r.shipment_id=p.id
 cross join lateral(select public.tracking_route_projection(p.id)as points)route
 where c.owner_actor_id is not null and r.recipient_role='OWNER'and r.revoked_at is null
 and public.business_customer_identity(c.owner_actor_id,false)and public.tracking_business_share_active(p.id,c.business_workspace_id)
 and p.operational_status<>'CANCELLED'and(p.guest_expires_at is null or p.guest_expires_at>clock_timestamp())
 and jsonb_typeof(route.points)='array'and jsonb_array_length(route.points)between 2 and 3
 and not exists(select 1 from jsonb_array_elements(route.points)point where jsonb_typeof(point)is distinct from 'object'
  or jsonb_typeof(point->'placeRef')is distinct from 'string'or nullif(point->>'placeRef','')is null
  or jsonb_typeof(point->'label')is distinct from 'string'or nullif(point->>'label','')is null
  or case when jsonb_typeof(point->'coordinate')='array'then
   case when jsonb_array_length(point->'coordinate')=2 and jsonb_typeof(point->'coordinate'->0)='number'and jsonb_typeof(point->'coordinate'->1)='number'
    then(point->'coordinate'->>0)::numeric not between -180 and 180 or(point->'coordinate'->>1)::numeric not between -90 and 90 else true end
   else true end)
 and not exists(select 1 from public.tracking_sessions s where s.shipment_id=p.id);
end $historybackfill229$;
create function pg_temp.session_state()returns jsonb language sql as $$
 select jsonb_build_object('sessions',(select md5(coalesce(jsonb_agg(to_jsonb(x)order by id),'[]')::text)from public.tracking_sessions x),
 'links',(select md5(coalesce(jsonb_agg(to_jsonb(x)order by id),'[]')::text)from public.tracking_session_links x),
 'shipments',(select md5(coalesce(jsonb_agg(to_jsonb(x)order by id),'[]')::text)from public.provider_shipments x),
 'events',(select count(*)from public.provider_shipment_events),'recipients',(select count(*)from public.provider_tracking_recipients),
 'outbox',(select count(*)from public.email_deliveries),'audit',(select count(*)from public.audit_logs),'businessAudit',(select count(*)from public.business_workspace_audit),
 'reviews',(select count(*)from public.provider_reviews),'policy',(select md5(coalesce(jsonb_agg(to_jsonb(x)order by user_id),'[]')::text)from public.user_policy_acceptances x));
$$;
create function pg_temp.session_denied(statement text,expected text)returns void language plpgsql as $$
declare before_state jsonb:=pg_temp.session_state();denied boolean:=false;
begin
 begin execute statement;exception when others then if sqlerrm<>expected then raise;end if;denied:=true;end;
 if not denied then raise exception 'SESSION229_EXPECTED_DENIAL:%',expected;end if;
 if before_state is distinct from pg_temp.session_state()then raise exception 'SESSION229_DENIAL_MUTATED_STATE:%',expected;end if;
end$$;
do $test$
declare employee uuid:=gen_random_uuid();provider_actor uuid:=gen_random_uuid();customer uuid:=gen_random_uuid();staff uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();platform_admin uuid:=gen_random_uuid();uid uuid;
 provider uuid:=gen_random_uuid();vehicle uuid;workspace uuid;foreign_workspace uuid;invitation uuid;version bigint;cities text[];command jsonb;result jsonb;guest jsonb;manager jsonb;
 session_id uuid;shipment uuid;link_id uuid;proof_id uuid;before_count integer;old_created timestamptz;old_expiry timestamptz;
 link1 text:=repeat('a',64);code1 text:=repeat('b',64);link2 text:=repeat('c',64);code2 text:=repeat('d',64);
 registered_shipment uuid:=gen_random_uuid();registered_session uuid;registered_command jsonb;registered_digest text:=repeat('e',64);status text;sig text;old_guest_expiry timestamptz;
begin
 foreach uid in array array[provider_actor,customer,staff,outsider,platform_admin]loop
  insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_user_meta_data)values(uid,'session229-'||uid||'@example.invalid',clock_timestamp(),clock_timestamp(),'{}');
 end loop;
 update profiles set role='DRIVER',active=true,drives_truck=true,full_name='Synthetic session provider'where id=provider_actor;
 update profiles set role='SHIPPER',active=true where id in(customer,staff,outsider);
 update profiles set role='ADMIN',active=true where id=platform_admin;
 insert into provider_profiles(id,user_id,business_name,handle)values(provider,provider_actor,'Synthetic session provider','session229-'||provider_actor);
 perform accept_content_policy(provider_actor,'2026-10-09');perform accept_content_policy(customer,'2026-10-09');
 vehicle:=(create_provider_vehicle(provider_actor,'{"make":"Synthetic","model":"Session truck","plate":"SESSION-229","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(provider_actor,jsonb_build_object('driver_user_id',provider_actor,'vehicle_id',vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
 workspace:=(business_workspace_create(customer,jsonb_build_object('name','Synthetic session broker','handle','session229-'||left(customer::text,12),'kind','BROKER'))->>'id')::uuid;
 foreign_workspace:=(business_workspace_create(outsider,jsonb_build_object('name','Synthetic foreign broker','handle','session229-'||left(outsider::text,12),'kind','BROKER'))->>'id')::uuid;
 select w.version into version from business_workspaces w where id=workspace;
 result:=business_workspace_command(customer,workspace,jsonb_build_object('action','INVITE','expectedVersion',version,'email','session229-'||staff||'@example.invalid','role','STAFF','capacity',false,'tracking',true));
 invitation:=(result->>'invitationId')::uuid;perform business_workspace_accept_invitation(staff,invitation);
 select array_agg(id order by id)into cities from(select id from place_catalog where latitude is not null and longitude is not null order by id limit 3)c;
 command:=jsonb_build_object('workspaceId',workspace,'route',jsonb_build_array(jsonb_build_object('placeRef',cities[1]),jsonb_build_object('placeRef',cities[2]),jsonb_build_object('placeRef',cities[3])),
 'cargoDescription','Synthetic session cargo','pickupDate',current_date,'deliveryDate',current_date+2);
 perform pg_temp.session_denied(format('select create_tracking_session(%L,%L::jsonb)',staff,command::text),'BUSINESS_FORBIDDEN');
 perform pg_temp.session_denied(format('select create_tracking_session(%L,%L::jsonb)',outsider,command::text),'BUSINESS_FORBIDDEN');
 perform pg_temp.session_denied(format('select create_tracking_session(%L,%L::jsonb)',platform_admin,command::text),'BUSINESS_FORBIDDEN');
 perform pg_temp.session_denied(format('select create_tracking_session(%L,%L::jsonb)',customer,(command||jsonb_build_object('route',jsonb_build_array(jsonb_build_object('placeRef',cities[1]),jsonb_build_object('placeRef',cities[1]),jsonb_build_object('placeRef',cities[3]))))::text),'ROUTE_LOCATIONS_MUST_DIFFER');
 result:=create_tracking_session(customer,command);session_id:=(result->>'id')::uuid;
 perform pg_temp.session_assert(result->>'state'='PENDING_PROVIDER'and result->'shipment'='null'::jsonb and result->'shipmentId'='null'::jsonb and jsonb_array_length(result->'route')=3,'SESSION229_PENDING_LEAK');
 perform pg_temp.session_assert((tracking_session_workspace(customer,workspace)->>'total')::integer=1 and(tracking_session_workspace(staff,workspace)->>'total')::integer=1,'SESSION229_WORKSPACE_LIST');
 perform pg_temp.session_denied(format('select tracking_session_workspace(%L,%L)',outsider,workspace),'BUSINESS_FORBIDDEN');
 perform pg_temp.session_denied(format('select issue_tracking_session_link(%L,%L,%L,%L,%L::jsonb)',staff,session_id,link1,code1,'{"allowLocation":false}'),'FORBIDDEN');
 perform pg_temp.session_denied(format('select issue_tracking_session_link(%L,%L,%L,%L,%L::jsonb)',customer,session_id,link1,code1,'{"expiresInDays":31,"allowLocation":true}'),'INVALID_TRACKING_INPUT');
 result:=issue_tracking_session_link(customer,session_id,link1,code1,'{"allowLocation":true}');link_id:=(result->>'id')::uuid;
 perform pg_temp.session_assert((result->>'expiresAt')::timestamptz-(result->>'createdAt')::timestamptz=interval '7 days'and result::text!~'digest|email|storage_path|linkToken|code','SESSION229_ISSUE_METADATA_OR_DEFAULT');
 perform pg_temp.session_assert(read_tracking_session_link(link1,null)is null and read_tracking_session_link(link1,repeat('f',64))is null and read_tracking_session_link(code1,link1)is null,'SESSION229_BOTH_CREDENTIALS_REQUIRED');
 guest:=read_tracking_session_link(link1,code1);
 perform pg_temp.session_assert(guest->>'id'=session_id::text and guest->'shipment'='null'::jsonb and guest::text!~'digest|email|storage_path|vehicleId|current_location','SESSION229_PENDING_GUEST_SCOPE');
 select created_at,expires_at into old_created,old_expiry from tracking_session_links where id=link_id;
 update tracking_session_links set created_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 day'where id=link_id;
 perform pg_temp.session_assert(read_tracking_session_link(link1,code1)is null,'SESSION229_EXPIRED_LINK_ACCEPTED');
 update tracking_session_links set created_at=old_created,expires_at=old_expiry where id=link_id;
 perform revoke_tracking_session_link(customer,session_id,link_id);
 perform pg_temp.session_assert(read_tracking_session_link(link1,code1)is null,'SESSION229_REVOKED_LINK_ACCEPTED');
 perform pg_temp.session_denied(format('select connect_tracking_session(%L,%L,%L,%L,%L::jsonb)',provider_actor,session_id,link1,code1,jsonb_build_object('vehicleId',vehicle,'trackingMode','LOCATION_AND_STATUS')::text),'TRACKING_ACCESS_DENIED');
 perform issue_tracking_session_link(customer,session_id,link2,code2,'{"allowLocation":true}');
 -- Guest credentials cannot claim even the holder's own vehicle.
 perform pg_temp.session_denied(format('select connect_tracking_session(%L,%L,%L,%L,%L::jsonb)',provider_actor,session_id,link2,code2,'{}'),'TRACKING_ACCESS_DENIED');
 perform pg_temp.session_denied(format('select accept_tracking_request(%L,%L,1,%L::jsonb)',provider_actor,session_id,'{"trackingMode":"STATUS_ONLY"}'),'TRACKING_ACCESS_DENIED');
 insert into company_pages(provider_profile_id,published,account_name) values(provider,true,'Synthetic session provider');
 perform set_provider_vehicle_publication(provider_actor,vehicle,'LIVE');
 -- Fleet membership alone cannot accept a request. Reassignment invalidates it.
 insert into auth.users(id,email,raw_user_meta_data) values(employee,'session231-'||employee||'@example.invalid','{}');
 perform fleet_register_driver(provider_actor,employee,jsonb_build_object('name','Test driver','email','session231-'||employee||'@example.invalid','phone','+251900000001'));
 perform pg_temp.session_assert((select can_manage_tracking and not can_manage_capacity from driver_permissions where user_id=employee),'NEW_DRIVER_TRACKING_DEFAULT');
 update auth.users set email_confirmed_at=now() where id=employee;
 perform accept_content_policy(employee,'2026-10-09');
 perform update_fleet_driver_access(provider_actor,jsonb_build_object('driver_user_id',employee,'vehicle_id',vehicle,'can_manage_tracking',true,'can_manage_capacity',false));
 result:=manage_tracking_request(customer,session_id,jsonb_build_object('action','SEARCH','query',''));
 result:=manage_tracking_request(customer,session_id,jsonb_build_object('action','SELECT','vehicleId',vehicle,'driverId',employee,'revision',result->'revision'));
 perform pg_temp.session_assert(incoming_tracking_requests(employee)->0->>'id'=session_id::text,'EMPLOYEE_CAN_ACCEPT_ASSIGNED_REQUEST');
 perform update_fleet_driver_access(provider_actor,jsonb_build_object('driver_user_id',employee,'vehicle_id',vehicle,'can_manage_tracking',false,'can_manage_capacity',false));
 perform pg_temp.session_assert(jsonb_array_length(incoming_tracking_requests(employee))=0 and incoming_tracking_requests(provider_actor)->0->>'id'=session_id::text,'EMPLOYER_OVERRIDE');
 perform pg_temp.session_denied(format('select accept_tracking_request(%L,%L,%s,%L::jsonb)',employee,session_id,result->>'revision','{"trackingMode":"STATUS_ONLY"}'),'TRACKING_ACCESS_DENIED');
 perform update_fleet_driver_access(provider_actor,jsonb_build_object('driver_user_id',provider_actor,'vehicle_id',vehicle,'can_manage_tracking',true,'can_manage_capacity',true));
 perform pg_temp.session_assert(jsonb_array_length(incoming_tracking_requests(provider_actor))=0,'STALE_ASSIGNMENT_INBOX');
 result:=manage_tracking_request(customer,session_id,jsonb_build_object('action','SEARCH','query',(select platform_number from vehicles where id=vehicle)));
 perform pg_temp.session_assert(result->'items'->0->>'vehicleId'=vehicle::text,'REQUEST_SEARCH_WITHOUT_CAPACITY');
 command:=jsonb_build_object('action','SELECT','vehicleId',vehicle,'driverId',provider_actor,'revision',result->'revision');
 perform pg_temp.session_denied(format('select manage_tracking_request(%L,%L,%L::jsonb)',staff,session_id,command),'FORBIDDEN');
 result:=manage_tracking_request(customer,session_id,command);
 version:=(result->>'revision')::bigint;
 perform pg_temp.session_denied(format('select manage_tracking_request(%L,%L,%L::jsonb)',customer,session_id,command),'TRACKING_SESSION_CHANGED');
 perform pg_temp.session_assert(incoming_tracking_requests(provider_actor)->0->>'id'=session_id::text and jsonb_array_length(incoming_tracking_requests(outsider))=0,'REQUEST_SCOPED_INBOX');
 perform pg_temp.session_denied(format('select accept_tracking_request(%L,%L,%s,%L::jsonb)',outsider,session_id,version,'{"trackingMode":"STATUS_ONLY"}'),'TRACKING_ACCESS_DENIED');
 result:=accept_tracking_request(provider_actor,session_id,version,'{"trackingMode":"LOCATION_AND_STATUS"}');shipment:=(result->>'shipmentId')::uuid;
 perform pg_temp.session_wire_shipment(result->'shipment');
 perform pg_temp.session_wire_shipment(tracking_session_detail(customer,session_id)->'shipment');
 perform pg_temp.session_assert(result->>'state'='CONNECTED'and result->'shipment'->'current_location'='null'::jsonb,'SESSION229_CONNECTION_OR_INVENTED_POINT');
 perform pg_temp.session_assert((select owner_user_id=customer from tracking_sessions where id=session_id)and(select shipper_email is null and receiver_email is null from provider_shipments where id=shipment)
 and not exists(select 1 from provider_tracking_recipients where shipment_id=shipment)and not exists(select 1 from email_deliveries where shipment_id=shipment),'SESSION229_FAKE_IDENTITY_OR_EMAIL');
 perform pg_temp.session_denied(format('select connect_tracking_session(%L,%L,%L,%L,%L::jsonb)',provider_actor,session_id,link2,code2,jsonb_build_object('vehicleId',vehicle,'trackingMode','LOCATION_AND_STATUS')::text),'TRACKING_ACCESS_DENIED');
 insert into provider_shipment_events(shipment_id,status,event_type,location_area,location_lat,location_lng,location_precision_km,location_source,created_by,created_at)
 values(shipment,'CREATED','LOCATION','Synthetic obscured phone area',9.11,38.81,10,'DEVICE_OBSCURED',provider_actor,clock_timestamp());
 guest:=read_tracking_session_link(link2,code2);
 perform pg_temp.session_wire_shipment(guest->'shipment');
 perform pg_temp.session_assert(guest->'shipment'->'current_location'->>'location_source'='DEVICE_OBSCURED'and guest->'shipment'->'current_location'->>'location_precision_km'='10'
 and guest->'shipment'->>'can_approve'='false'and guest->'shipment'->>'can_review'='false'and guest->'shipment'->>'can_share'='false'and guest::text!~'storage_path|recipient|email|contactPhone|driverPhone','SESSION229_GUEST_PRIVACY_OR_PHONE');
 manager:=tracking_session_detail(staff,session_id);
 perform pg_temp.session_assert(manager->'shipment'->'current_location'='null'::jsonb and manager->'capabilities'->>'canIssueLink'='false'and manager->'capabilities'->>'canReadProof'='false','SESSION229_STAFF_ESCALATION');
 perform pg_temp.session_denied(format('select approve_tracking_session_handover(%L,%L)',staff,session_id),'TRACKING_APPROVAL_FORBIDDEN');
 perform pg_temp.session_denied(format('select approve_tracking_session_handover(%L,%L)',customer,session_id),'TRACKING_APPROVAL_FORBIDDEN');
 perform update_provider_tracking_status(provider_actor,shipment,'{"next_status":"LOADING","proof":{"path":"supabase://shipment-proof/session229-loading.jpg","original_name":"loading.jpg","mime_type":"image/jpeg"}}');
 select id into proof_id from provider_shipment_events e where e.shipment_id=shipment and e.status='LOADING'and e.proof_storage_path is not null;
 perform pg_temp.session_assert(tracking_session_proof_file(customer,session_id,proof_id)is not null and tracking_session_proof_file(provider_actor,session_id,proof_id)is not null
 and tracking_session_proof_file(staff,session_id,proof_id)is null and tracking_session_proof_file(outsider,session_id,proof_id)is null and tracking_session_proof_file(null,session_id,proof_id)is null
 and tracking_session_proof_file(customer,session_id,gen_random_uuid())is null,'SESSION229_PROOF_AUTHORITY');
 guest:=read_tracking_session_link(link2,code2);
 perform pg_temp.session_assert(not exists(select 1 from jsonb_array_elements(guest->'shipment'->'events')e where(e->>'has_proof')::boolean),'SESSION229_GUEST_PROOF_METADATA');
 perform update_provider_tracking_status(provider_actor,shipment,'{"next_status":"IN_TRANSIT","location":{"area":"Synthetic obscured phone area","lat":9.11,"lng":38.81,"precision_km":10,"source":"DEVICE_OBSCURED"}}');
 perform update_provider_tracking_status(provider_actor,shipment,'{"next_status":"UNLOADING","proof":{"path":"supabase://shipment-proof/session229-unloading.jpg","original_name":"unloading.jpg","mime_type":"image/jpeg"}}');
 perform pg_temp.session_denied(format('select approve_tracking_session_handover(%L,%L)',provider_actor,session_id),'TRACKING_APPROVAL_FORBIDDEN');
 perform approve_tracking_session_handover(customer,session_id);
 select count(*)into before_count from provider_shipment_events e where e.shipment_id=shipment;
 perform approve_tracking_session_handover(customer,session_id);
 perform pg_temp.session_assert((select count(*)from provider_shipment_events e where e.shipment_id=shipment)=before_count and not exists(select 1 from email_deliveries where shipment_id=shipment),'SESSION229_COMPLETION_REPLAY_OR_NULL_EMAIL');
 perform pg_temp.session_assert(read_tracking_session_link(link2,code2)->'shipment'->'current_location'='null'::jsonb,'SESSION229_TERMINAL_LOCATION');
 perform pg_temp.session_denied(format('select review_tracking_session_provider(%L,%L,%L::jsonb)',staff,session_id,'{"rating":5,"note":"Unauthorized","termsAccepted":true}'),'REVIEW_NOT_ALLOWED');
 perform pg_temp.session_denied(format('select review_tracking_session_provider(%L,%L,%L::jsonb)',customer,session_id,'{"rating":5,"termsAccepted":false}'),'INVALID_RATING');
 perform review_tracking_session_provider(customer,session_id,'{"rating":5,"note":"Synthetic authenticated customer review","termsAccepted":true}');
 manager:=tracking_session_detail(customer,session_id);guest:=read_tracking_session_link(link2,code2);
 perform pg_temp.session_assert(manager->'shipment'->'review'->>'rating'='5'and manager->'shipment'->'review'->>'note'='Synthetic authenticated customer review'
 and manager->'capabilities'->>'canReview'='false'and not(guest->'shipment'?'review'),'SESSION229_SAVED_REVIEW_READBACK_OR_GUEST_LEAK');
 perform pg_temp.session_denied(format('select review_tracking_session_provider(%L,%L,%L::jsonb)',customer,session_id,'{"rating":4,"termsAccepted":true}'),'REVIEW_NOT_ALLOWED');
 -- Existing provider Start keeps a real registered account and no access email.
 registered_command:=jsonb_build_object('id',registered_shipment,'code','LGX-'||upper(left(replace(registered_shipment::text,'-',''),8)),'vehicle_id',vehicle,
 'origin_place_ref',cities[1],'passing_place_ref',cities[2],'destination_place_ref',cities[3],'cargo_summary','Synthetic registered customer cargo',
 'customer_email','unknown-session229@example.invalid','customer_email_digest',registered_digest,'tracking_mode','LOCATION_AND_STATUS','expected_delivery_date',current_date+2,
 'tracking_code_hash',repeat('1',64),'review_code_hash',repeat('2',64));
 perform pg_temp.session_denied(format('select create_provider_tracking_with_recipients(%L,%L::jsonb)',provider_actor,registered_command::text),'TRACKING_REGISTERED_OWNER_REQUIRED');
 perform create_provider_tracking_with_recipients(provider_actor,registered_command||jsonb_build_object('customer_email','session229-'||customer||'@example.invalid'));
 select id into registered_session from tracking_sessions where shipment_id=registered_shipment;
 perform pg_temp.session_assert((select owner_user_id=customer from tracking_sessions where id=registered_session)and not exists(select 1 from email_deliveries where shipment_id=registered_shipment and delivery_kind='TRACKING_ACCESS')
 and(tracking_session_workspace(customer,null)->>'total')::integer=1 and tracking_session_detail(customer,registered_session)->>'id'=registered_session::text,'SESSION229_REGISTERED_OWNER_BINDING_OR_EMAIL');
 perform pg_temp.session_denied(format('select tracking_owner_sharing_command(%L,%L,clock_timestamp(),%L::jsonb)',registered_shipment,registered_digest,'{"action":"ADD_VIEWER","expectedRevision":0,"name":"Retired viewer","email":"nobody@example.invalid","digest":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}'),'TRACKING_EMAIL_SHARING_RETIRED');
 -- A guest link follows its issuer's current sharing authority on this load.
 perform issue_tracking_session_link(customer,registered_session,repeat('4',64),repeat('5',64),'{"allowLocation":false}');
 perform pg_temp.session_assert(read_tracking_session_link(repeat('4',64),repeat('5',64)) is not null,'REGISTERED_OWNER_LINK_UNREADABLE');
 update provider_tracking_recipients set revoked_at=clock_timestamp() where shipment_id=registered_shipment and recipient_role='OWNER';
 perform pg_temp.session_assert(read_tracking_session_link(repeat('4',64),repeat('5',64)) is null,'REVOKED_OWNER_LINK_READABLE');
 update provider_tracking_recipients set revoked_at=null where shipment_id=registered_shipment and recipient_role='OWNER';
 -- Actual account ownership remains the captured ID even if a teammate later
 -- receives its old address. Model the legacy email-based control separately;
 -- the new authenticated HTTP bridge must require canManageTeam as well.
 perform pg_temp.session_assert(tracking_session_detail(customer,registered_session)->'capabilities'->>'canManageTeam'='true'
 and tracking_session_detail(provider_actor,registered_session)->'capabilities'->>'canManageTeam'='false','SESSION229_CAPTURED_TEAM_OWNER_CAPABILITY');
 perform tracking_owner_sharing_command(registered_shipment,registered_digest,clock_timestamp(),jsonb_build_object('action','ATTACH_BUSINESS','expectedRevision',0,'workspaceId',workspace),customer);
 perform link_tracking_shipment(customer,registered_shipment,workspace);
 insert into provider_shipment_events(shipment_id,status,event_type,location_area,location_lat,location_lng,location_precision_km,location_source,created_by,created_at)
 values(registered_shipment,'CREATED','LOCATION','Synthetic registered obscured area',9.11,38.81,10,'DEVICE_OBSCURED',provider_actor,clock_timestamp());
 manager:=business_tracking_detail(customer,workspace,registered_shipment);
 perform pg_temp.session_assert(manager->>'isOwner'='true'and manager->'shipment'->>'can_view_location'='true'
 and manager->'shipment'->'current_location'<>'null'::jsonb,'SESSION229_CAPTURED_BUSINESS_OWNER_POSITIVE');
 -- Model pre229 history using only this normal fixture's retained captured
 -- business attachment. Remove the additive session, never change real rows.
 delete from tracking_sessions where shipment_id=registered_shipment;
 update tracking_sharing_controls set owner_actor_id=null where shipment_id=registered_shipment;
 perform pg_temp.session_denied(format('select link_tracking_shipment(%L,%L,null)',customer,registered_shipment),'NOT_FOUND');
 result:=link_tracking_shipment(provider_actor,registered_shipment,null);
 perform pg_temp.session_assert((select owner_user_id is null from tracking_sessions where shipment_id=registered_shipment)
 and result->'capabilities'->>'canManageTeam'='false'and(tracking_session_workspace(customer,null)->>'total')::integer=0,'SESSION229_UNKNOWN_HISTORY_EMAIL_OWNER_CLAIM');
 delete from tracking_sessions where shipment_id=registered_shipment;
 update tracking_sharing_controls set owner_actor_id=outsider where shipment_id=registered_shipment;
 perform pg_temp.session_history_backfill();
 perform pg_temp.session_assert(not exists(select 1 from tracking_sessions where shipment_id=registered_shipment),'SESSION229_FOREIGN_CONTROL_BACKFILLED');
 update tracking_sharing_controls set owner_actor_id=customer where shipment_id=registered_shipment;
 update provider_tracking_recipients set revoked_at=clock_timestamp()where shipment_id=registered_shipment and recipient_role='OWNER';
 perform pg_temp.session_history_backfill();
 perform pg_temp.session_assert(not exists(select 1 from tracking_sessions where shipment_id=registered_shipment),'SESSION229_REVOKED_HISTORY_BACKFILLED');
 update provider_tracking_recipients set revoked_at=null where shipment_id=registered_shipment and recipient_role='OWNER';
 select guest_expires_at into old_guest_expiry from provider_shipments where id=registered_shipment;
 update provider_shipments set guest_expires_at=clock_timestamp()-interval '1 second'where id=registered_shipment;
 perform pg_temp.session_history_backfill();
 perform pg_temp.session_assert(not exists(select 1 from tracking_sessions where shipment_id=registered_shipment),'SESSION229_EXPIRED_HISTORY_BACKFILLED');
 update provider_shipments set guest_expires_at=old_guest_expiry,operational_status='CANCELLED'where id=registered_shipment;
 perform pg_temp.session_history_backfill();
 perform pg_temp.session_assert(not exists(select 1 from tracking_sessions where shipment_id=registered_shipment),'SESSION229_CANCELLED_HISTORY_BACKFILLED');
 update provider_shipments set operational_status='CREATED'where id=registered_shipment;
 perform pg_temp.session_history_backfill();
 select id into registered_session from tracking_sessions where shipment_id=registered_shipment;
 perform pg_temp.session_assert(registered_session is not null and(select owner_user_id=customer and workspace_id=workspace from tracking_sessions where id=registered_session)
 and(tracking_session_workspace(customer,null)->>'total')::integer=1,'SESSION229_CAPTURED_HISTORY_PERSONAL_LIST_MISSING');
 perform pg_temp.session_history_backfill();
 perform pg_temp.session_assert((select count(*)=1 from tracking_sessions where shipment_id=registered_shipment)
 and(select id=registered_session from tracking_sessions where shipment_id=registered_shipment),'SESSION229_HISTORY_BACKFILL_OVERWROTE_SESSION');
 update auth.users set email='session229-new-'||customer||'@example.invalid'where id=customer;
 update auth.users set email='session229-'||customer||'@example.invalid'where id=staff;
 -- Existing legacy control can recognize a recycled address; it must never
 -- override the independently captured session owner account.
 update tracking_sharing_controls set owner_actor_id=staff where shipment_id=registered_shipment;
 manager:=tracking_session_detail(staff,registered_session);
 perform pg_temp.session_assert(manager->>'id'=registered_session::text and manager->'capabilities'->>'canManageTeam'='false'
 and manager->'capabilities'->>'canApprove'='false'and manager->'capabilities'->>'canReadProof'='false'
 and tracking_session_detail(customer,registered_session)->'capabilities'->>'canManageTeam'='true','SESSION229_RECYCLED_OWNER_EMAIL_ESCALATION');
 perform pg_temp.session_assert(tracking_owner_is_member_identity(staff,(select owner_recipient_id from tracking_sharing_controls where shipment_id=registered_shipment))
 and tracking_business_share_active(registered_shipment,workspace),'SESSION229_LEGACY_RECYCLED_ADDRESS_FIXTURE_OR_SHARE_CHANGED');
 manager:=business_tracking_detail(staff,workspace,registered_shipment);
 perform pg_temp.session_assert(manager->>'isOwner'='false'and manager->'shipment'->>'recipient_role'='BUSINESS_STAFF'
 and manager->'shipment'->>'can_view_location'='false'and manager->'shipment'->'current_location'='null'::jsonb
 and manager->'shipment'->>'can_approve'='false'and manager->'shipment'->>'can_review'='false'and manager->'shipment'->>'can_share'='false'
 and manager->'shipment'->'review'='null'::jsonb and not exists(select 1 from jsonb_array_elements(manager->'shipment'->'events')e where(e->>'has_proof')::boolean),
 'SESSION229_RECYCLED_BUSINESS_OWNER_ENVELOPE_ESCALATION');
 insert into tracking_staff_location_grants(shipment_id,user_id,workspace_id,member_revision,granted_by_recipient_id)
 select registered_shipment,staff,workspace,m.revision,c.owner_recipient_id from business_workspace_members m cross join tracking_sharing_controls c
 where m.workspace_id=workspace and m.user_id=staff and c.shipment_id=registered_shipment;
 manager:=business_tracking_detail(staff,workspace,registered_shipment);
 perform pg_temp.session_assert(manager->>'isOwner'='false'and manager->'shipment'->>'can_view_location'='true'
 and manager->'shipment'->'current_location'<>'null'::jsonb and manager->'shipment'->>'can_approve'='false','SESSION229_EXPLICIT_STAFF_LOCATION_LOST_OR_ELEVATED');

 update business_workspace_members set active=false where workspace_id=workspace and user_id=staff;
 perform pg_temp.session_denied(format('select tracking_session_detail(%L,%L)',staff,session_id),'NOT_FOUND');
 foreach sig in array array['public.manage_tracking_request(uuid,uuid,jsonb)','public.accept_tracking_request(uuid,uuid,bigint,jsonb)','public.incoming_tracking_requests(uuid)','public.create_tracking_session(uuid,jsonb)','public.connect_tracking_session(uuid,uuid,text,text,jsonb)','public.read_tracking_session_link(text,text)','public.tracking_session_proof_file(uuid,uuid,uuid)','public.approve_tracking_session_handover(uuid,uuid)','public.review_tracking_session_provider(uuid,uuid,jsonb)']loop
  perform pg_temp.session_assert(not has_function_privilege('anon',sig,'execute')and not has_function_privilege('authenticated',sig,'execute')and has_function_privilege('service_role',sig,'execute'),'SESSION229_RPC_BROWSER_EXPOSURE');
 end loop;
 perform pg_temp.session_assert(not has_function_privilege('service_role','public.create_tracking_session_shipment(uuid,jsonb)','execute')
 and not has_function_privilege('service_role','public.request_tracking_email_session(uuid,text,text,text,timestamptz)','execute')
 and has_function_privilege('service_role','public.provider_guest_tracking_for_recipient(uuid,text)','execute')
 and not has_function_privilege('service_role','public.consume_tracking_email_session(uuid,text,text)','execute')
 and not has_table_privilege('service_role','public.tracking_session_links','select')and not has_table_privilege('authenticated','public.tracking_sessions','select')
 and(select relrowsecurity from pg_class where oid='public.tracking_sessions'::regclass)and(select relrowsecurity from pg_class where oid='public.tracking_session_links'::regclass),'SESSION229_PRIVATE_BOUNDARY');
 raise notice 'PASS: session229 pair scope, expiry/revocation, tenant/staff denials, provider connection, actual-account proofs/completion/review, registered owner and no access email';
end $test$;
rollback;
