-- FEAT-IAM/PRV/MKT-001. Owned synthetic transaction; no fixture/customer mutation.
begin;
create function pg_temp.account_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is not true then raise exception '%',label;end if;end$$;
create function pg_temp.account_denied(statement text,code text) returns void language plpgsql as $$
begin begin execute statement;exception when others then if sqlerrm=code then return;end if;raise;end;raise exception 'ACCOUNT_EXPECTED_DENIAL:%',code;end$$;
do $test$
declare actor uuid:=gen_random_uuid();other_actor uuid:=gen_random_uuid();company_actor uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();new_actor uuid:=gen_random_uuid();
 provider uuid:=gen_random_uuid();other_provider uuid:=gen_random_uuid();org uuid:=gen_random_uuid();business uuid;
 old_handle text:='old-'||replace(provider::text,'-','');new_handle text:='chosen-'||replace(provider::text,'-','');private_marker text:='PrivateFather167';
 result jsonb;before_page jsonb;before_profile jsonb;before_provider jsonb;places jsonb;truck uuid;capacity_id uuid;company_truck uuid;company_capacity uuid;signature text;intention uuid;admin_id uuid;deletion uuid;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (actor,'identity167-'||actor||'@example.test',now(),'{}'),(other_actor,'identity167-'||other_actor||'@example.test',now(),'{}'),
 (company_actor,'identity167-'||company_actor||'@example.test',now(),'{}'),(employee,'identity167-'||employee||'@example.test',now(),'{}'),
 (new_actor,'identity167-'||new_actor||'@example.test',now(),'{}');
 update profiles set active=true,role='DRIVER',drives_truck=true,first_name='Aster Hana',last_name=private_marker,full_name='Aster Hana '||private_marker where id=actor;
 update profiles set active=true,role='DRIVER',first_name='Unrelated',last_name=private_marker where id=other_actor;
 update profiles set active=true,role='TRANSPORTER',drives_truck=true,first_name='Company Manager',last_name=private_marker where id=company_actor;
 update profiles set active=true,role='DRIVER',first_name='Beka',last_name=private_marker,full_name='Beka '||private_marker where id=employee;
 insert into provider_profiles(id,user_id,business_name,handle,public_visibility) values
 (provider,actor,'LegacyLegal167 '||private_marker,old_handle,'PUBLIC'),(other_provider,other_actor,'Unrelated private name','other-'||replace(other_provider::text,'-',''),'PUBLIC');
 insert into company_pages(provider_profile_id,published,contact_phone,show_contact_phone,about,headline)
 values(provider,true,'+251900000167',true,private_marker,private_marker),(other_provider,true,null,false,null,null);
 perform accept_content_policy(actor,'2026-10-09');perform accept_content_policy(company_actor,'2026-10-09');
 perform pg_temp.account_denied(format('select update_provider_profile_page(%L,%L)',other_actor,jsonb_build_object('account_name','Not accepted','handle','not-accepted-'||replace(other_actor::text,'-',''))),'POLICY_REQUIRED');
 perform accept_content_policy(other_actor,'2026-10-09');
 result:=public_provider_page_details(null,provider);
 perform pg_temp.account_assert(result->>'account_name'='Aster Hana' and result->>'manager_name'='Aster Hana' and position(private_marker in result::text)=0,'SAFE_LEGACY_PUBLIC_FALLBACK');
 before_profile:=(select to_jsonb(p) from profiles p where id=actor);before_provider:=(select to_jsonb(p)-'handle' from provider_profiles p where id=provider);
 before_page:=(select to_jsonb(c)-array['account_name','updated_at'] from company_pages c where provider_profile_id=provider);
 perform update_provider_profile_page(actor,jsonb_build_object('account_name','Rift Road','handle',new_handle));
 perform pg_temp.account_assert((select to_jsonb(c)-array['account_name','updated_at'] from company_pages c where provider_profile_id=provider)=before_page,'IDENTITY_ONLY_EDIT_ERASED_PROFILE');
 perform pg_temp.account_assert((select to_jsonb(p) from profiles p where id=actor)=before_profile and(select to_jsonb(p)-'handle' from provider_profiles p where id=provider)=before_provider,'PUBLIC_IDENTITY_CHANGED_PRIVATE_NAME_OR_AUTHORITY');
 result:=provider_profile_workspace(actor);
 perform pg_temp.account_assert(result->>'account_name'='Rift Road' and result->>'name'='Rift Road' and result->>'manager_name'='Aster Hana' and result->>'handle'=new_handle,'OWN_PROFILE_IDENTITY_MISSING');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform pg_temp.account_assert(current_user_projection()->>'provider_account_name'='Rift Road','WORKSPACE_DISPLAY_NOT_UPDATED');
 result:=resolve_public_provider_handle(old_handle);
 perform pg_temp.account_assert(result->>'id'=provider::text and result->>'handle'=new_handle,'OLD_HANDLE_LOST_OR_REASSIGNED');
 perform pg_temp.account_denied(format('select update_provider_profile_page(%L,%L)',other_actor,jsonb_build_object('account_name','Would roll back','handle',old_handle)),'ACCOUNT_HANDLE_UNAVAILABLE');
 perform pg_temp.account_assert((select account_name is null from company_pages where provider_profile_id=other_provider),'HANDLE_CONFLICT_PARTIAL_NAME_COMMIT');
 perform pg_temp.account_denied(format('select update_provider_profile_page(%L,%L)',actor,'{"manager_name":"PrivateFather167"}'),'INVALID_PROVIDER_PROFILE_INPUT');
 perform pg_temp.account_denied(format('select update_provider_profile_page(%L,%L)',actor,'{"account_name":"","handle":"valid-name"}'),'INVALID_PUBLIC_ACCOUNT_NAME');
 perform pg_temp.account_denied(format('select update_provider_profile_page(%L,%L)',actor,'{"account_name":"Good name","handle":"admin"}'),'INVALID_ACCOUNT_HANDLE');
 update company_pages set published=false where provider_profile_id=provider;
 perform pg_temp.account_assert(resolve_public_provider_handle(old_handle) is null,'HIDDEN_ALIAS_EXPOSED');
 update company_pages set published=true where provider_profile_id=provider;
 -- A business account shares the namespace, never a public provider destination.
 result:=business_workspace_create(other_actor,jsonb_build_object('name','Synthetic cargo workspace','handle','cargo-'||replace(other_actor::text,'-',''),'kind','BROKER'));
 business:=(result->>'id')::uuid;
 perform pg_temp.account_assert(resolve_public_provider_handle(result->>'handle') is null,'BUSINESS_EXPOSED_AS_PUBLIC_PROVIDER');
 perform pg_temp.account_denied(format('select update_provider_profile_page(%L,%L)',actor,jsonb_build_object('account_name','Rift Road','handle',result->>'handle')),'ACCOUNT_HANDLE_UNAVAILABLE');
 perform pg_temp.account_denied(format('select business_workspace_create(%L,%L)',other_actor,jsonb_build_object('name','Would conflict','handle',new_handle,'kind','BROKER')),'ACCOUNT_HANDLE_UNAVAILABLE');
 -- Search uses the three intended public identity fields while retaining all
 -- original truck eligibility, optional company About/city and driver pairing.
 select jsonb_agg(jsonb_build_object('place_ref',p.id,'label',p.name,'lat',p.latitude,'lng',p.longitude) order by p.id) into places
 from(select id,name,latitude,longitude from place_catalog where latitude between -90 and 90 and longitude between -180 and 180 order by id limit 2) p;
 perform pg_temp.account_assert(jsonb_array_length(places)=2,'ACCOUNT_PLACE_FIXTURES_REQUIRED');
 truck:=(create_provider_vehicle(actor,jsonb_build_object('make','Synthetic identity','model','Account test','plate','ACCT-'||left(actor::text,8),'cargo_configuration','Cargo van','use_basis','OWNED'))->>'id')::uuid;
 perform update_fleet_driver_access(actor,jsonb_build_object('driver_user_id',actor,'vehicle_id',truck,'can_manage_capacity',true,'can_manage_tracking',true));
 perform set_provider_vehicle_publication(actor,truck,'LIVE');
 capacity_id:=publish_provider_capacity(actor,jsonb_build_object('vehicle_id',truck,'status','EMPTY','accepted_loads','BOTH','availability_geometry','ROUTE','location_source','DEVICE_OBSCURED','approximate_lat',(places->0->>'lat')::float8,'approximate_lng',(places->0->>'lng')::float8,'location_precision_km',10,'current_route_places',places,'sharing_mode','BOTH'));
 for signature in select unnest(array['Rift Road',new_handle,'Aster Hana']) loop
  result:=capacity_search_results(jsonb_build_object('q',signature,'provider',new_handle));
  perform pg_temp.account_assert(jsonb_array_length(result->'items')=1 and result->'items'->0->>'title'='Rift Road' and result->'items'->0->>'account_name'='Rift Road' and result->'items'->0->>'manager_name'='Aster Hana','PUBLIC_IDENTITY_NOT_SEARCHABLE:'||signature);
 end loop;
 foreach signature in array array[private_marker,'LegacyLegal167'] loop
  result:=capacity_search_results(jsonb_build_object('q',signature,'provider',new_handle));
  perform pg_temp.account_assert(jsonb_array_length(result->'items')=0,'PRIVATE_LEGAL_NAME_SEARCHED');
 end loop;
 insert into organizations(id,name,handle,type,city) values(org,'Existing company public name','company-'||replace(org::text,'-',''),'TRANSPORT_COMPANY','PublicCity167');
 insert into organization_members(organization_id,user_id,membership_role) values(org,company_actor,'OWNER'),(org,employee,'DRIVER');
 insert into drivers(organization_id,user_id,name,phone,active) values(org,employee,'Beka '||private_marker,'+251900000168',true);
 insert into company_pages(organization_id,published,about,headline,base_region_code) values(org,true,'Specialised publicAbout167','Public headline','OROMIA');
 perform update_provider_profile_page(company_actor,jsonb_build_object('account_name','Highland Dispatch','handle','highland-'||replace(org::text,'-','')));
 company_truck:=(create_provider_vehicle(company_actor,jsonb_build_object('make','Synthetic company','model','Driver test','plate','CO-'||left(company_actor::text,8),'cargo_configuration','Cargo van','use_basis','OWNED'))->>'id')::uuid;
 perform update_fleet_driver_access(company_actor,jsonb_build_object('driver_user_id',employee,'vehicle_id',company_truck,'can_manage_capacity',true,'can_manage_tracking',true));
 perform set_provider_vehicle_publication(company_actor,company_truck,'LIVE');
 perform accept_content_policy(employee,'2026-10-09');
 company_capacity:=publish_provider_capacity(employee,jsonb_build_object('vehicle_id',company_truck,'status','EMPTY','accepted_loads','BOTH','availability_geometry','ROUTE','location_source','DEVICE_OBSCURED','approximate_lat',(places->0->>'lat')::float8,'approximate_lng',(places->0->>'lng')::float8,'location_precision_km',10,'current_route_places',places,'sharing_mode','PUBLIC'));
 result:=capacity_search_results(jsonb_build_object('q','Beka','provider','highland-'||replace(org::text,'-','')));
 perform pg_temp.account_assert((result->>'total')::int=0,'EMPLOYED_DRIVER_NAME_NOT_STANDALONE_SEARCH');
 result:=capacity_search_results(jsonb_build_object('q','Highland Dispatch','provider','highland-'||replace(org::text,'-','')));
 perform pg_temp.account_assert((result->>'total')::int=1 and result->'items'->0->>'kind'='COMPANY' and result->'items'->0->>'account_name'='Highland Dispatch' and result->'items'->0->>'manager_name'='Company Manager' and (result->'items'->0->>'matching_trucks')::int=1,'EMPLOYED_VEHICLE_REMAINS_IN_PROVIDER_ACCOUNT');
 foreach signature in array array['publicAbout167','PublicCity167'] loop
  result:=capacity_search_results(jsonb_build_object('q',signature,'provider','highland-'||replace(org::text,'-','')));
  perform pg_temp.account_assert(jsonb_array_length(result->'items')>0,'PUBLIC_SECONDARY_SEARCH_LOST');
 end loop;
 perform pg_temp.account_denied(format('select update_provider_profile_page(%L,%L)',employee,'{"account_name":"Employee takeover","handle":"employee-takeover"}'),'FORBIDDEN');
 -- Normal verified signup keeps legal/private and public identities separate.
 intention:=prepare_provider_signup_identity(encode(gen_random_bytes(32),'hex'),jsonb_build_object('firstName','李','lastName',private_marker,'phone','+251900000169','applicationType','SELF_MANAGED_DRIVER','accountName','Road Friends','handle','signup-'||replace(new_actor::text,'-',''),'notes',''),now()+interval '10 minutes');
 perform accept_content_policy(new_actor,'2026-10-09');
 perform complete_eligible_provider_signup(new_actor,(select token_digest from provider_signup_intents where id=intention));
 result:=provider_profile_workspace(new_actor);
 perform pg_temp.account_assert(result->>'account_name'='Road Friends' and result->>'manager_name'='李' and result->>'handle'='signup-'||replace(new_actor::text,'-',''),'SIGNUP_PUBLIC_IDENTITY_NOT_SAVED');
 perform pg_temp.account_assert((select first_name='李' and last_name=private_marker and role::text='DRIVER' from profiles where id=new_actor),'SIGNUP_PRIVATE_NAMES_OR_ROLE_CHANGED');
 foreach signature in array array['public.account_claim_public_handle(text,uuid,text)','public.provider_public_account_identity(uuid,uuid)','public.provider_public_account_name(uuid,uuid)','public.set_provider_public_identity(uuid,jsonb)','public.resolve_public_provider_handle(text)'] loop
  perform pg_temp.account_assert(not has_function_privilege('anon',signature,'EXECUTE') and not has_function_privilege('authenticated',signature,'EXECUTE'),'BROWSER_IDENTITY_RPC');
 end loop;
 perform pg_temp.account_assert(not has_table_privilege('anon','public.account_public_handles','SELECT') and not has_table_privilege('authenticated','public.account_public_handles','SELECT'),'BROWSER_HANDLE_REGISTRY');
 -- The new chosen public name is erased through the same existing guarded
 -- lifecycle; reserved aliases cannot resurrect the removed public identity.
 admin_id:=gen_random_uuid();insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(admin_id,'identity167-'||admin_id||'@example.test',now(),'{}');
 update profiles set active=true,role='ADMIN' where id=admin_id;
 perform pg_temp.account_denied(format('select request_account_deletion(%L)',new_actor),'ACCOUNT_REAUTH_REQUIRED');
 update auth.users set last_sign_in_at=clock_timestamp() where id=new_actor;
 deletion:=(request_account_deletion(new_actor)->>'id')::uuid;
 result:=prepare_account_erasure(admin_id,deletion);
 perform pg_temp.account_assert(result->>'status'='ERASING','OWN_IDENTITY_ERASURE_NOT_PREPARED');
 update auth.users set deleted_at=now() where id=new_actor;
 result:=finish_account_erasure(admin_id,deletion);
 perform pg_temp.account_assert(result->>'status'='COMPLETED' and not exists(select 1 from company_pages c join provider_profiles p on p.id=c.provider_profile_id where p.user_id=new_actor and c.account_name is not null),'CHOSEN_ACCOUNT_NAME_RETAINED_AFTER_ERASURE');
 perform pg_temp.account_assert(resolve_public_provider_handle('signup-'||replace(new_actor::text,'-','')) is null,'ERASED_ALIAS_EXPOSED');
 raise notice 'PASS: chosen public identity, private manager boundary, role preservation, atomic global handles and aliases, signup and search';
end $test$;
rollback;
