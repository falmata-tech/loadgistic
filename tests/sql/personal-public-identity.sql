-- FEAT-IAM/PRV-001: synthetic local identity fixtures, every write rolls back.
begin;
create function pg_temp.assert_identity(ok boolean,message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception '%',message;end if;end $$;
create function pg_temp.identity_denied(statement text,expected text) returns void language plpgsql as $$
begin
 begin execute statement;raise exception 'IDENTITY_UNEXPECTEDLY_ALLOWED';
 exception when raise_exception then if sqlerrm<>expected then raise;end if;end;
end $$;
do $identity$
declare person uuid:=gen_random_uuid();other_person uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();payload jsonb;value text;signature text;
 private_marker text:='Personalprivate141';original_name text;legacy_business text;public_phone text:='+251900000141';
 places jsonb;cities text[];truck uuid;capacity_id uuid;photo uuid:=gen_random_uuid();org uuid:=gen_random_uuid();company_driver uuid:=gen_random_uuid();shipment uuid:=gen_random_uuid();company_payload jsonb;command jsonb;before_extras jsonb;count_rows integer;candidate jsonb;signup_user uuid:=gen_random_uuid();signup_intent uuid;broker_actor uuid:=gen_random_uuid();broker_workspace uuid;connection_id uuid;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (person,'identity-'||person||'@example.test',now(),'{}'),(other_person,'identity-'||other_person||'@example.test',now(),'{}');
 update profiles set active=true,role='DRIVER',drives_truck=true,full_name=U&' LegacyFirst\0085\00A0Personalprivate141',phone='+251911999141' where id=person;
 update profiles set active=true,role='DRIVER',full_name='Unrelated Private Person' where id=other_person;
 perform accept_content_policy(person,'2026-10-09');
 insert into provider_profiles(id,user_id,business_name,handle,public_visibility)
 values(provider,person,'LegacyFirst Personalprivate141','identity-'||provider,'PUBLIC');
 insert into company_pages(provider_profile_id,published,contact_phone,show_contact_phone,about,headline,contact_email,show_contact_email,contact_whatsapp,show_contact_whatsapp,contact_website,show_contact_website)
 values(provider,true,public_phone,true,private_marker,private_marker,private_marker||'@example.test',true,'+251900999141',true,'https://'||private_marker||'.example.test',true);
 -- The pre-141 contract cannot execute this safe authoritative helper.
 perform pg_temp.assert_identity(public_person_first_name(person)='LegacyFirst','HISTORICAL_UNICODE_FIRST_NAME_LEAK');
 foreach value in array array[E'\t',E'\n',U&'\00A0',U&'\2000',U&'\2028',U&'\2029',U&'\202F',U&'\3000'] loop
  update profiles set full_name='LegacyFirst'||value||private_marker where id=person;
  perform pg_temp.assert_identity(public_person_first_name(person)='LegacyFirst','HISTORICAL_WHITESPACE_SURNAME_LEAK');
 end loop;
 perform pg_temp.assert_identity(public_person_callback_phone(person)=public_phone,'EXPLICIT_LEGACY_CALLBACK_LOST');
 original_name:=(select full_name from profiles where id=person);legacy_business:=(select business_name from provider_profiles where id=provider);
 perform update_own_account_details(person,'{"firstName":" Aster\u00a0Hana ","lastName":"","phone":""}');
 perform pg_temp.assert_identity(public_person_first_name(person)='Aster Hana','COMPOUND_FIRST_NAME_TRUNCATED');
 perform pg_temp.assert_identity((select full_name=original_name and last_name is null from profiles where id=person),'HISTORICAL_PRIVATE_NAME_ERASED_OR_GUESSED');
 perform update_own_account_details(person,'{"firstName":"Aster Hana","lastName":"Personalprivate141","phone":"+1.612.555.0100","publicCallbackPhone":"+1.612.555.0100"}');
 perform pg_temp.assert_identity(public_person_callback_phone(person)='+1.612.555.0100' and(select phone='+1.612.555.0100' from profiles where id=person),'SELF_FORMATTED_PHONE_NOT_SAVED');
 perform update_own_account_details(person,'{"name":"Legacy Private Change","phone":"+1.612.555.0100"}');
 perform pg_temp.assert_identity((select first_name='Aster Hana' and last_name=private_marker and public_callback_phone_configured from profiles where id=person),'OLD_CLIENT_ERASED_STRUCTURED_IDENTITY');
 perform pg_temp.assert_identity(public_person_callback_phone(person)='+1.612.555.0100','OLD_CLIENT_ERASED_CALLBACK');
 perform update_own_account_details(person,'{"firstName":"Aster Hana","lastName":"Personalprivate141","phone":"","publicCallbackPhone":""}');
 perform pg_temp.assert_identity(public_person_callback_phone(person) is null,'CLEARED_CALLBACK_RESURRECTED');
 update profiles set public_callback_phone=null,public_callback_phone_configured=false where id=person;
 update company_pages set show_contact_phone=false,contact_phone='+251900777141' where provider_profile_id=provider;
 perform update_own_account_details(person,'{"firstName":"Aster Hana","lastName":"Personalprivate141","phone":"","publicCallbackPhone":""}');
 update company_pages set show_contact_phone=true,contact_phone='+251900888141' where provider_profile_id=provider;
 perform pg_temp.assert_identity((select public_callback_phone_configured from profiles where id=person) and public_person_callback_phone(person) is null,'EMPTY_EXPLICIT_HIDE_RESURRECTED_LEGACY_PHONE');
 perform pg_temp.assert_identity((select business_name=legacy_business from provider_profiles where id=provider),'HISTORICAL_BUSINESS_NAME_REWRITTEN');
 select jsonb_agg(jsonb_build_object('place_ref',p.id,'label',p.name,'lat',p.latitude,'lng',p.longitude) order by p.id),array_agg(p.id order by p.id) into strict places,cities
 from(select id,name,latitude,longitude from place_catalog where latitude between -90 and 90 and longitude between -180 and 180 order by id limit 3) p;
 perform pg_temp.assert_identity(jsonb_array_length(places)=3,'IDENTITY_CATALOG_FIXTURE_REQUIRED');
 update provider_profiles set city='Registrationprivate141',city_place_ref=cities[1] where id=provider;
 update company_pages set base_region_code='OROMIA' where provider_profile_id=provider;
 before_extras:=(select to_jsonb(p)-array['updated_at','published','base_region_code'] from company_pages p where provider_profile_id=provider);
 perform update_provider_profile_page(person,jsonb_build_object('base_place_ref',cities[1],'base_region_code','OROMIA','published',true));
 perform pg_temp.assert_identity((select to_jsonb(p)-array['updated_at','published','base_region_code'] from company_pages p where provider_profile_id=provider)=before_extras,'PERSONAL_PARTIAL_EDITOR_ERASED_STORED_EXTRAS');
 update provider_profiles set city='Registrationprivate141' where id=provider;
 truck:=(create_provider_vehicle(person,jsonb_build_object('make','Synthetic identity','model','Personal truck','plate','IDENTITY-'||left(person::text,8),'cargo_configuration','Cargo van','use_basis','OWNED'))->>'id')::uuid;
 perform update_fleet_driver_access(person,jsonb_build_object('driver_user_id',person,'vehicle_id',truck,'can_manage_capacity',true,'can_manage_tracking',true));
 perform set_provider_vehicle_publication(person,truck,'LIVE');
 capacity_id:=publish_provider_capacity(person,jsonb_build_object('vehicle_id',truck,'status','EMPTY','accepted_loads','BOTH','availability_geometry','ROUTE','location_source','DEVICE_OBSCURED',
 'approximate_lat',(places->0->>'lat')::float8,'approximate_lng',(places->0->>'lng')::float8,'location_precision_km',20,'current_route_places',places-2,'sharing_mode','BOTH'));
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 values(broker_actor,'identity-broker-'||broker_actor||'@example.invalid',now(),'{}');
 update profiles set role='SHIPPER',active=true where id=broker_actor;
 broker_workspace:=(business_workspace_create(broker_actor,jsonb_build_object('name','Identity broker','handle','identity-broker-'||left(broker_actor::text,12),'kind','BROKER'))->>'id')::uuid;
 connection_id:=(request_account_connection(person,'BUSINESS',broker_workspace)->>'id')::uuid;
 perform decide_account_connection(broker_actor,connection_id,'ACCEPT');
 perform grant_account_capacity_access(person,connection_id,truck);
 insert into driver_portrait_uploads(id,user_id,file_path,size_bytes,state,upload_finished)
 values(photo,person,'supabase://provider-profile/driver-portrait/2026-10-13/'||photo||'.jpg',1024,'ACTIVE',true);
 perform pg_temp.assert_identity(public_person_portrait_url(person)='/api/public/driver-portraits/'||photo,'OWN_ACTIVE_PORTRAIT_MISSING');
 perform pg_temp.assert_identity(public_person_portrait_url(other_person) is null,'UNRELATED_PORTRAIT_INHERITED');
 -- Execute all five caller-appropriate projections, rather than checking their
 -- source strings. Registered-account facts carry the same safe personal identity.
 foreach signature in array array[
  format('select payload from public_capacity_page(%L)',jsonb_build_object('capacity_id',capacity_id)),
  format('select payload from capacity_search_public_rows(%L)',jsonb_build_object('capacity_id',capacity_id)),
  format('select payload from account_capacity_filtered_page(%L,%L,null,null,100,%L)',broker_actor,repeat('6',64),jsonb_build_object('capacity_id',capacity_id)),
  format('select payload from account_capacity_filtered_page(%L,%L,null,null,100,%L)',broker_actor,repeat('6',64),jsonb_build_object('provider','identity-'||provider)),
  format('select payload from account_capacity_filtered_page(%L,%L,null,null,100,%L)',broker_actor,repeat('6',64),jsonb_build_object('status','EMPTY','vehicle_category','Cargo van'))
 ] loop
  count_rows:=0;
  for payload in execute signature loop
   count_rows:=count_rows+1;
   perform pg_temp.assert_identity(payload->>'provider_name'='Aster Hana' and payload->>'assigned_driver_first_name'='Aster Hana' and payload->>'assigned_driver_portrait_url'='/api/public/driver-portraits/'||photo,'REAL_PROJECTION_PERSON_IDENTITY_WRONG');
   perform pg_temp.assert_identity(strpos(payload::text,private_marker)=0 and strpos(payload::text,'supabase://')=0 and payload->>'assigned_driver_phone' is null and payload->>'contact_email' is null and payload->>'contact_website' is null and payload->>'contact_whatsapp' is null,'REAL_PROJECTION_PRIVATE_DATA_RETURNED');
   perform pg_temp.assert_identity(jsonb_array_length(payload->'current_route_points')=2,'PUBLIC_TRUCK_GEOMETRY_LOST');
  end loop;
  perform pg_temp.assert_identity(count_rows=1,'REAL_PROJECTION_FIXTURE_NOT_RETURNED');
 end loop;
 select p.payload into strict payload from public_capacity_page(jsonb_build_object('capacity_id',capacity_id)) p;
 perform pg_temp.assert_identity(not capacity_search_matches(payload,jsonb_build_object('q',private_marker)),'PRIVATE_SURNAME_BUSINESS_ABOUT_INDEXED');
 perform pg_temp.assert_identity(not capacity_search_matches(payload,jsonb_build_object('office_city','Registrationprivate141')),'PERSONAL_REGISTRATION_CITY_INDEXED');
 candidate:=capacity_search_results(jsonb_build_object('provider','identity-'||provider,'q',private_marker));
 perform pg_temp.assert_identity(jsonb_array_length(candidate->'items')=0,'PRIVATE_SURNAME_SEARCH_RESULT_RETURNED');
 perform pg_temp.assert_identity(jsonb_array_length(capacity_search_results(jsonb_build_object('provider','identity-'||provider,'q','Aster Hana'))->'items')=1,'PUBLIC_COMPOUND_FIRST_NOT_SEARCHABLE');
 -- Actual Featured projection, including the required explicit public contact.
 insert into verification_requests(subject_type,subject_id,verification_type,document_name,storage_path,original_name,mime_type,status,submitted_by,reviewed_at)
 values('PROVIDER_PROFILE',provider,'IDENTITY','Synthetic','synthetic-private-proof','synthetic.jpg','image/jpeg','APPROVED',person,now()),
 ('PROVIDER_PROFILE',provider,'DRIVER_IDENTITY','Synthetic','synthetic-private-proof-2','synthetic.jpg','image/jpeg','APPROVED',person,now()),
 ('VEHICLE',truck,'VEHICLE_OWNERSHIP','Synthetic','synthetic-private-proof-3','synthetic.jpg','image/jpeg','APPROVED',person,now());
 select p into strict candidate from public_featured_provider_candidates(array['OROMIA']) p where p->>'provider_profile_id'=provider::text;
 perform pg_temp.assert_identity(candidate->>'name'='Aster Hana' and candidate->>'eligible'='false' and candidate->>'base_place' is null and candidate->>'base_region_code' is null and strpos(candidate::text,private_marker)=0,'FEATURED_PERSONAL_NAME_CONTACT_OR_BASE_LEAK');
 perform update_own_account_details(person,'{"firstName":"Aster Hana","lastName":"Personalprivate141","phone":"","publicCallbackPhone":"+251900123141"}');
 select p into strict candidate from public_featured_provider_candidates(array['OROMIA']) p where p->>'provider_profile_id'=provider::text;
 perform pg_temp.assert_identity(candidate->>'eligible'='true','FEATURED_EXPLICIT_CALLBACK_NOT_ELIGIBLE');
 update provider_profiles set content_hidden=true where id=provider;
 perform pg_temp.assert_identity(public_person_portrait_url(person) is null,'MODERATED_PORTRAIT_RETURNED');
 update provider_profiles set content_hidden=false,public_visibility='PUBLIC' where id=provider;
 -- Guest Tracking retains its grant checks while its provider/driver names are
 -- safe. The private shipment-controller detail may still contain full names.
 command:=jsonb_build_object('id',shipment,'code','LGX-'||upper(left(replace(shipment::text,'-',''),8)),'vehicle_id',truck,
 'origin_place_ref',cities[1],'passing_place_ref',cities[2],'destination_place_ref',cities[3],
 'cargo_summary','Synthetic identity shipment','customer_email','identity-tracking@example.test','customer_email_digest',repeat('7',64),
 'expected_delivery_date',(current_date+2)::text,'tracking_mode','LOCATION_AND_STATUS','tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex'));
 perform create_provider_tracking_with_recipients(person,command);
 candidate:=provider_guest_tracking_for_recipient(shipment,repeat('7',64));
 perform pg_temp.assert_identity(candidate->>'provider_name'='Aster Hana' and candidate->'public_truck_summary'->>'driverName'='Aster Hana' and candidate->'public_truck_summary'->>'driverPortrait'='/api/public/driver-portraits/'||photo and strpos(candidate::text,private_marker)=0,'GUEST_TRACKING_PERSONAL_PRIVATE_DATA_RETURNED');
 perform pg_temp.assert_identity(provider_guest_tracking_for_recipient(shipment,repeat('8',64)) is null,'GUEST_TRACKING_FOREIGN_GRANT_ALLOWED');
 perform pg_temp.assert_identity((provider_tracking_detail(person,shipment::text)->>'driver_name')=(select full_name from profiles where id=person),'PRIVATE_CONTROLLER_FULL_NAME_LOST');
 -- Company business fields and existing fleet-management authority stay intact.
 update profiles set role='TRANSPORTER' where id=other_person;
 perform accept_content_policy(other_person,'2026-10-09');
 insert into organizations(id,name,handle,type,city) values(org,'Company Business141','company-identity-'||org,'TRANSPORT_COMPANY','Company City141');
 insert into organization_members(organization_id,user_id,membership_role) values(org,other_person,'OWNER');
 insert into company_pages(organization_id,published,headline,about,contact_email,show_contact_email) values(org,true,'Company Headline141','Company About141','company-public@example.test',true);
 company_payload:=public_provider_page_details(org,null);
 perform pg_temp.assert_identity(company_payload->>'public_name'='Company Business141' and company_payload->>'about'='Company About141' and company_payload->>'contact_email'='company-public@example.test','COMPANY_PUBLIC_INFORMATION_LOST');
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(company_driver,'identity-company-driver-'||company_driver||'@example.test',now(),'{}');
 update profiles set role='DRIVER',active=true,first_name='Company Compound',last_name='PrivateCompanySurname141',full_name='Company Compound PrivateCompanySurname141' where id=company_driver;
 insert into organization_members(organization_id,user_id,membership_role) values(org,company_driver,'DRIVER');
 insert into drivers(organization_id,user_id,name,phone,active) values(org,company_driver,'Company Compound PrivateCompanySurname141','+251900444141',true);
 perform fleet_update_driver_contact(other_person,jsonb_build_object('driver_user_id',company_driver,'name','Authorized Private Correction','phone','+251900555141'));
 perform pg_temp.assert_identity((select first_name='Company Compound' and last_name='PrivateCompanySurname141' and full_name='Authorized Private Correction' and public_callback_phone_configured from profiles where id=company_driver),'FLEET_CORRECTION_ERASED_STRUCTURED_IDENTITY');
 perform pg_temp.assert_identity(public_person_callback_phone(company_driver)='+251900555141','AUTHORIZED_FLEET_CALLBACK_NOT_SYNCHRONIZED');
 payload:=public_provider_page_details(null,provider);
 perform pg_temp.assert_identity(payload->>'public_name'='Aster Hana' and strpos(payload::text,private_marker)=0,'PERSONAL_PROFILE_PRIVATE_FIELDS_RETURNED');
 perform pg_temp.assert_identity(not exists(select 1 from public_person_identities(array[person]) p where p.first_name<>'Aster Hana' or p.callback_phone is distinct from '+251900123141'),'SAFE_PERSON_RPC_WRONG');
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(signup_user,'identity-signup-'||signup_user||'@example.test',now(),'{}');
 perform pg_temp.identity_denied(format('select prepare_provider_signup_identity(%L,%L,now()+interval ''10 minutes'')',repeat('b',64),jsonb_build_object('firstName','Aster','lastName','','phone','.......','applicationType','SELF_MANAGED_DRIVER','notes','')),'INVALID_SIGNUP_PHONE');
 signup_intent:=prepare_provider_signup_identity(repeat('a',64),jsonb_build_object('firstName','李','lastName','','phone','+1.612.555.0100','applicationType','SELF_MANAGED_DRIVER','notes',''),now()+interval '10 minutes');
 perform complete_eligible_provider_signup(signup_user,repeat('a',64));
 perform pg_temp.assert_identity((select first_name='李' and last_name='' and full_name='李' and phone='+1.612.555.0100' from profiles where id=signup_user) and public_person_first_name(signup_user)='李' and public_person_callback_phone(signup_user) is null,'ONE_CHARACTER_STRUCTURED_SIGNUP_OR_PRIVATE_PHONE_WRONG');
 perform pg_temp.identity_denied(format('select update_own_account_details(%L,%L)',person,jsonb_build_object('firstName','Aster','lastName','','phone','','driverId',other_person)),'INVALID_ACCOUNT_DETAILS');
 perform pg_temp.identity_denied('select count(*) from public_person_identities(array_fill(gen_random_uuid(),array[101]))','INVALID_PUBLIC_PERSON_SCOPE');
 perform pg_temp.identity_denied('select count(*) from public_person_identities(array[null::uuid])','INVALID_PUBLIC_PERSON_SCOPE');
 foreach signature in array array['public.public_person_first_name(uuid)','public.public_person_callback_phone(uuid)','public.public_person_portrait_url(uuid)','public.public_person_identities(uuid[])'] loop
  perform pg_temp.assert_identity(not has_function_privilege('anon',signature,'EXECUTE') and not has_function_privilege('authenticated',signature,'EXECUTE'),'BROWSER_PERSONAL_RPC');
 end loop;
 update profiles set active=false where id=person;
 perform pg_temp.identity_denied(format('select update_own_account_details(%L,%L)',person,'{"firstName":"Aster","lastName":"","phone":"","publicCallbackPhone":"+251900123141"}'),'FORBIDDEN');
 raise notice 'PASS: Unicode and compound public first names, private history, self-only callback clear, safe profile and browser denial';
end $identity$;
rollback;
