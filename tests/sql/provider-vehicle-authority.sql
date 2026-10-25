-- FEAT-VER/FLT/CAP/PRV-001 / ADR-079. Isolated local clone only; rollback fixtures.
begin;
do $test$
declare owner_id uuid:=gen_random_uuid();org uuid:=gen_random_uuid();admin_id uuid;outsider uuid;driver_id uuid:=gen_random_uuid();truck uuid;other_truck uuid;licence_truck uuid;
 source_id uuid;permission_source uuid;licence_source uuid;review_id uuid;permission_review uuid;licence_review uuid;
 req_before jsonb;command jsonb;state jsonb;summary jsonb;first_page jsonb;last_page jsonb;context jsonb;i integer;
 synthetic_driver uuid:=gen_random_uuid();origin_ref text;destination_ref text;license_query jsonb;licence_item jsonb;capacity_id uuid;
 original_revision text;
 hidden_draft uuid;baseline_summary jsonb;basic_rows jsonb:='[]'::jsonb;featured_row jsonb;page_index integer;legacy_truck uuid;broker_actor uuid:=gen_random_uuid();broker_workspace uuid;connection_id uuid;
begin
 -- CI's named market providers have explicit fictional relationship reviews.
 -- Own the no-review legacy scenario instead of deleting or revoking seed facts.
 select id into strict admin_id from public.profiles where active and role='ADMIN' order by id limit 1;
 select p.id into strict outsider from public.profiles p join public.organization_members m on m.user_id=p.id
 where p.active and p.role='TRANSPORTER' and m.membership_role='OWNER' and m.organization_id<>org order by p.id limit 1;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)values
  (owner_id,'authority-owner-'||owner_id||'@example.test',now(),'{}','{}'),
  (driver_id,'authority-employee-'||driver_id||'@example.test',now(),'{}','{}'),
  (broker_actor,'authority-broker-'||broker_actor||'@example.invalid',now(),'{}','{}');
 update public.profiles set role='TRANSPORTER',active=true,drives_truck=false where id=owner_id;
 update public.profiles set role='SHIPPER',active=true where id=broker_actor;
 insert into public.organizations(id,name,handle,type,city,city_place_ref,public_visibility)
 values(org,'Synthetic authority provider','authority-provider-'||org,'TRANSPORT_COMPANY','Addis Ababa',
  (select id from public.place_catalog where normalized_name='addis ababa'limit 1),'PUBLIC');
 insert into public.organization_members(user_id,organization_id,membership_role)values(owner_id,org,'OWNER');
 insert into public.company_pages(organization_id,published,base_region_code,contact_phone,show_contact_phone)
 values(org,true,'ADDIS_ABABA','+251900000146',true);
 broker_workspace:=(public.business_workspace_create(broker_actor,jsonb_build_object('name','Authority broker','handle','authority-broker-'||left(broker_actor::text,12),'kind','BROKER'))->>'id')::uuid;
 perform public.accept_content_policy(owner_id,'2026-10-09');
 perform public.fleet_register_driver(owner_id,driver_id,jsonb_build_object('email','authority-employee-'||driver_id||'@example.test',
  'name','Synthetic authority employee','phone','+251900000147'));
 for i in 1..2 loop
  legacy_truck:=(public.create_provider_vehicle(owner_id,jsonb_build_object('make','Isuzu','model','Synthetic legacy truck',
   'plate','AUTHORITY-LEGACY-'||i,'cargo_configuration','Mini Box Truck','use_basis','PERMISSION'))->>'id')::uuid;
  -- Model migration145's retained legacy Live flags, not a publication command.
  -- The negative assertions below prove that those flags grant no qualification.
  update public.vehicles set publication_status='LIVE'where id=legacy_truck and organization_id=org;
 end loop;
 truck:=(public.create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Authority fixture","plate":"AUTHORITY-1","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 other_truck:=(public.create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Other fixture","plate":"AUTHORITY-2","cargo_configuration":"Mini Box Truck","use_basis":"PERMISSION"}')->>'id')::uuid;
 if(public.managed_provider_publication_eligibility(owner_id)->>'qualifyingTruckCount')::integer<>0 then raise exception 'LEGACY_APPROVAL_UPGRADED';end if;
 if(public.provider_vehicle_authority_state(truck)->'ownership'->>'verified')::boolean then raise exception 'DECLARATION_AWARDED_BADGE';end if;
 -- This synthetic legacy workspace already has multiple Live trucks. Its old
 -- unreviewed flags are retained, but cannot unlock an additional publication.
 if(public.managed_provider_publication_eligibility(owner_id)->>'liveTruckCount')::integer<=1 then raise exception 'LEGACY_FLEET_FIXTURE_REQUIRED';end if;
 begin perform public.set_provider_vehicle_publication(owner_id,truck,'LIVE');raise exception 'UNREVIEWED_ADDITIONAL_PUBLICATION_ALLOWED';exception when raise_exception then if sqlerrm<>'PROVIDER_VERIFICATION_REQUIRED' then raise;end if;end;
 command:=jsonb_build_object('subject_type','VEHICLE','subject_id',truck,'verification_type','VEHICLE_OWNERSHIP',
  'document_name','Authority fixture title','storage_path','supabase://verification/verification/authority-fixture.pdf','original_name','fixture.pdf','mime_type','application/pdf');
 source_id:=public.submit_managed_verification(owner_id,command);
 begin perform public.confirm_provider_vehicle_authority(admin_id,source_id,'{"fact_kind":"OWNERSHIP","review_note":"Matched exact title holder."}');raise exception 'PENDING_SOURCE_CONFIRMED';exception when raise_exception then if sqlerrm<>'AUTHORITY_SOURCE_NOT_APPROVED' then raise;end if;end;
 perform public.review_managed_verification(admin_id,source_id,'APPROVED','Document reviewed.');
 select to_jsonb(r) into req_before from public.verification_requests r where r.id=source_id;
 if(public.managed_provider_publication_eligibility(owner_id)->>'canPublish')::boolean then raise exception 'GENERIC_APPROVAL_UPGRADED';end if;
 begin perform public.confirm_provider_vehicle_authority(owner_id,source_id,'{"fact_kind":"OWNERSHIP","review_note":"I own this truck."}');raise exception 'OWNER_SELF_CONFIRMED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform public.confirm_provider_vehicle_authority(admin_id,source_id,'{"fact_kind":"PERMISSION","expires_on":"2999-01-01","review_note":"Wrong evidence category."}');raise exception 'WRONG_CATEGORY_ALLOWED';exception when raise_exception then if sqlerrm<>'AUTHORITY_SOURCE_MISMATCH' then raise;end if;end;
 original_revision:=public.managed_provider_authority_review_context(admin_id,array[source_id])->0->>'contextRevision';
 update public.vehicles set plate='AUTHORITY-STALE-FORM' where id=truck;
 begin perform public.confirm_provider_vehicle_authority(admin_id,source_id,jsonb_build_object('fact_kind','OWNERSHIP','review_note','Matched stale identity.','context_revision',original_revision));raise exception 'STALE_IDENTITY_REVIEW_ALLOWED';exception when raise_exception then if sqlerrm<>'AUTHORITY_CONTEXT_CHANGED' then raise;end if;end;
 if exists(select 1 from public.provider_vehicle_authority_reviews where source_request_id=source_id) then raise exception 'STALE_REVIEW_INSERTED';end if;
 update public.vehicles set plate='AUTHORITY-1' where id=truck;
 review_id:=public.confirm_provider_vehicle_authority(admin_id,source_id,jsonb_build_object('fact_kind','OWNERSHIP','review_note','Matched exact provider title holder.','context_revision',original_revision));
 if(select to_jsonb(r) from public.verification_requests r where r.id=source_id)<>req_before then raise exception 'TERMINAL_REVIEW_REWRITTEN';end if;
 begin perform public.confirm_provider_vehicle_authority(admin_id,source_id,'{"fact_kind":"OWNERSHIP","review_note":"Repeated title review."}');raise exception 'DUPLICATE_CONFIRMATION_ALLOWED';exception when raise_exception then if sqlerrm<>'AUTHORITY_ALREADY_CONFIRMED' then raise;end if;end;
 state:=public.provider_vehicle_authority_state(truck);
 if not(state->'ownership'->>'verified')::boolean or(state->'permission'->>'verified')::boolean or(state->'operatingLicence'->>'verified')::boolean then raise exception 'FACTS_CONFLATED';end if;
 if not(public.managed_provider_publication_eligibility(owner_id)->>'canPublish')::boolean then raise exception 'DRAFT_CANNOT_QUALIFY';end if;
 perform public.set_provider_vehicle_publication(owner_id,other_truck,'LIVE');
 if driver_id is not null then begin perform public.set_provider_vehicle_publication(driver_id,other_truck,'DRAFT');raise exception 'EMPLOYEE_PUBLISH_ALLOWED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;end if;
 begin perform public.set_provider_vehicle_publication(outsider,other_truck,'DRAFT');raise exception 'FOREIGN_OWNER_PUBLISH_ALLOWED';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 if(public.provider_vehicle_authority_state(other_truck)->>'qualifiesProvider')::boolean then raise exception 'QUALIFIER_COPIED_TO_OTHER_TRUCK';end if;
 context:=public.managed_provider_authority_review_context(admin_id,array[source_id]);
 if context::text~'storage_path|original_name|vehicle_identity_digest' then raise exception 'PRIVATE_FILE_METADATA_IN_CONTEXT';end if;
 if context->0->'supportedFacts'<>'["OWNERSHIP"]'::jsonb then raise exception 'REVIEW_CONTEXT_MISSING';end if;

 -- Permission can be independently reviewed, but it never unlocks a provider.
 command:=command||jsonb_build_object('subject_id',other_truck,'verification_type','VEHICLE_AUTHORIZATION','related_vehicle_id',other_truck,'expires_on',current_date+30);
 permission_source:=public.submit_managed_verification(owner_id,command);perform public.review_managed_verification(admin_id,permission_source,'APPROVED','Permission document reviewed.');
 permission_review:=public.confirm_provider_vehicle_authority(admin_id,permission_source,jsonb_build_object('fact_kind','PERMISSION','expires_on',current_date+30,'review_note','Matched permission beneficiary.',
  'context_revision',public.managed_provider_authority_review_context(admin_id,array[permission_source])->0->>'contextRevision'));
 perform public.revoke_provider_vehicle_authority(admin_id,review_id,'Title holder correction.');
 if(public.managed_provider_publication_eligibility(owner_id)->>'canPublish')::boolean then raise exception 'PERMISSION_UNLOCKED_PROVIDER';end if;
 if public.provider_vehicle_discovery_allows(other_truck) then raise exception 'LOST_QUALIFIER_DISCOVERY_ALLOWED';end if;
 if(select publication_status from public.vehicles where id=other_truck)<>'LIVE' then raise exception 'LIVE_CHOICE_DELETED';end if;
 if not(public.provider_vehicle_authority_state(other_truck)->'permission'->>'verified')::boolean then raise exception 'PERMISSION_FACT_LOST';end if;
 begin perform public.revoke_provider_vehicle_authority(admin_id,review_id,'Repeated title correction.');raise exception 'REVOCATION_REPLAY_ALLOWED';exception when raise_exception then if sqlerrm<>'AUTHORITY_ALREADY_REVOKED' then raise;end if;end;
 begin perform public.confirm_provider_vehicle_authority(admin_id,source_id,jsonb_build_object('fact_kind','OWNERSHIP','review_note','Replayed old confirmation form.','context_revision',original_revision));raise exception 'OLD_FORM_UNDID_REVOCATION';exception when raise_exception then if sqlerrm<>'AUTHORITY_CONTEXT_CHANGED' then raise;end if;end;

 -- A financed-purchase licence in the provider's name is a separate qualifier.
 licence_truck:=(public.create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Financed fixture","plate":"AUTHORITY-FIN","cargo_configuration":"Mini Box Truck","use_basis":"FINANCED"}')->>'id')::uuid;
 command:=command||jsonb_build_object('subject_id',licence_truck,'verification_type','VEHICLE_OPERATING_LICENSE','related_vehicle_id',licence_truck,'expires_on',current_date+30);
 licence_source:=public.submit_managed_verification(owner_id,command);perform public.review_managed_verification(admin_id,licence_source,'APPROVED','Licence document reviewed.');
 licence_item:=jsonb_build_object('vehicle_id',licence_truck,'provider_organization_id',org,'provider_profile_id',null);
 license_query:=jsonb_build_object('truck_docs','VEHICLE_OPERATING_LICENSE','vehicle_ids',jsonb_build_array(licence_truck));
 if public.capacity_search_matches(licence_item,license_query) then raise exception 'GENERIC_LICENCE_APPROVAL_MATCHED_REVIEW_FILTER';end if;
 begin perform public.confirm_provider_vehicle_authority(admin_id,licence_source,jsonb_build_object('fact_kind','OPERATING_LICENCE','holder_basis','PERMISSION','expires_on',current_date+30,'review_note','Rented truck licence not beneficiary.'));raise exception 'RENTED_LICENCE_QUALIFIED';exception when raise_exception then if sqlerrm<>'AUTHORITY_HOLDER_BASIS_REQUIRED' then raise;end if;end;
 licence_review:=public.confirm_provider_vehicle_authority(admin_id,licence_source,jsonb_build_object('fact_kind','OPERATING_LICENCE','holder_basis','FINANCED','expires_on',current_date+30,'review_note','Matched financed purchase and licence holder.',
  'context_revision',public.managed_provider_authority_review_context(admin_id,array[licence_source])->0->>'contextRevision'));
 state:=public.provider_vehicle_authority_state(licence_truck);
 if not(state->'operatingLicence'->>'verified')::boolean or(state->'ownership'->>'verified')::boolean or state->'operatingLicence'->>'holderBasis'<>'FINANCED' then raise exception 'FINANCING_BECAME_OWNERSHIP';end if;
 if not public.capacity_search_matches(licence_item,license_query) then raise exception 'REVIEWED_LICENCE_FILTER_MISSING';end if;
 if public.capacity_search_matches(licence_item,license_query||jsonb_build_object('truck_docs','VEHICLE_OWNERSHIP')) then raise exception 'LICENCE_MATCHED_OWNERSHIP_FILTER';end if;
 perform public.set_provider_vehicle_publication(owner_id,licence_truck,'LIVE');
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
 values(synthetic_driver,'authority-driver-'||synthetic_driver||'@example.test',now(),'{}','{}');
 perform public.fleet_register_driver(owner_id,synthetic_driver,jsonb_build_object('email','authority-driver-'||synthetic_driver||'@example.test','name','Synthetic Driver','phone','+251900000146'));
 perform public.update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',synthetic_driver,'vehicle_id',licence_truck,'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.accept_content_policy(synthetic_driver,'2026-10-09');
 perform public.refresh_provider_capacity_location(synthetic_driver,jsonb_build_object('vehicle_id',licence_truck,'approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 select id into origin_ref from public.place_catalog where normalized_name='addis ababa' limit 1;
 select id into destination_ref from public.place_catalog where normalized_name='adama' limit 1;
 capacity_id:=public.publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',licence_truck,'status','EMPTY','visibility','OPEN','sharing_mode','PUBLIC',
  'availability_geometry','ROUTE','accepted_loads','FTL','current_route_places',jsonb_build_array(jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
  'location_source','PRESERVE_DRIVER'));
 if not exists(select 1 from public.public_capacity_page(license_query,null,null,14) row where row.payload->>'vehicle_id'=licence_truck::text
  and(row.payload->'authority'->'operatingLicence'->>'verified')::boolean) then raise exception 'PUBLIC_LICENCE_FILTER_MISSING';end if;
 if not exists(select 1 from public.capacity_search_public_rows(license_query,null,null,14) row where row.payload->>'vehicle_id'=licence_truck::text) then raise exception 'SEARCH_LICENCE_FILTER_MISSING';end if;
 if exists(select 1 from public.public_capacity_page(license_query||jsonb_build_object('truck_docs','VEHICLE_OWNERSHIP'),null,null,14) row) then raise exception 'WRONG_DOCUMENT_FILTER_RETURNED_TRUCK';end if;
 connection_id:=(public.request_account_connection(owner_id,'BUSINESS',broker_workspace)->>'id')::uuid;
 perform public.decide_account_connection(broker_actor,connection_id,'ACCEPT');
 perform public.grant_account_capacity_access(owner_id,connection_id,licence_truck);
 if not exists(select 1 from public.account_capacity_filtered_page(broker_actor,repeat('6',64),null,null,100,license_query) row
  where row.payload->>'vehicle_id'=licence_truck::text and(row.payload->'authority'->'operatingLicence'->>'verified')::boolean)
  then raise exception 'PRIVATE_LICENCE_FILTER_MISSING';end if;
 if (public.account_capacity_search_results(broker_actor,repeat('6',64),license_query,1)->>'total')::integer<1 then raise exception 'PRIVATE_SEARCH_LICENCE_FILTER_MISSING';end if;
 if exists(select 1 from public.account_capacity_filtered_page(owner_id,repeat('7',64),null,null,100,license_query))
  then raise exception 'FOREIGN_RECIPIENT_LICENSE_ACCESS';end if;
 for i in 1..13 loop
  truck:=(public.create_provider_vehicle(owner_id,jsonb_build_object('make','Isuzu','model','Pagination fixture','plate','AUTHORITY-PAGE-'||i,'cargo_configuration','Mini Box Truck','use_basis','PERMISSION'))->>'id')::uuid;
  perform public.set_provider_vehicle_publication(owner_id,truck,'LIVE');
 end loop;
 baseline_summary:=public.provider_fleet_authority_summary(org,null);
 hidden_draft:=(public.create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Private draft fixture","plate":"AUTHORITY-PRIVATE-DRAFT","cargo_configuration":"Mini Box Truck","use_basis":"FINANCED"}')->>'id')::uuid;
 if public.provider_fleet_authority_summary(org,null)<>baseline_summary then raise exception 'DRAFT_LEAKED_IN_FULL_FLEET_COUNT';end if;
 first_page:=public.public_provider_fleet_page(org,null,1);last_page:=public.public_provider_fleet_page(org,null,2);summary:=first_page->'authority_summary';
 if summary<>last_page->'authority_summary' or(first_page->>'total')::integer<>(last_page->>'total')::integer then raise exception 'SUMMARY_DEPENDS_ON_PAGE';end if;
 if(summary->>'total')::integer<15 or(summary->>'financedVerified')::integer<>1 or(summary->>'operatingLicenceVerified')::integer<>1
  or(summary->>'permissionVerified')::integer<>1 then raise exception 'FULL_FLEET_SUMMARY_INCORRECT';end if;
 if summary::text~'holderName|source_request|storage_path|reviewed_by' then raise exception 'PUBLIC_PRIVATE_METADATA_LEAK';end if;
 if(summary->>'ownershipVerified')::integer+(summary->>'operatingLicenceVerified')::integer+(summary->>'permissionVerified')::integer+(summary->>'notYetVerified')::integer<>(summary->>'total')::integer then raise exception 'SUMMARY_DOUBLE_COUNTED';end if;
 for page_index in 1..(first_page->>'page_count')::integer loop
  basic_rows:=basic_rows||(public.public_provider_fleet_page(org,null,page_index)->'items');
 end loop;
 if exists(select 1 from jsonb_array_elements(basic_rows) row where row->>'id'=hidden_draft::text)
  then raise exception 'PRIVATE_DRAFT_METADATA_DISCLOSED';end if;
 if exists(select 1 from jsonb_array_elements(basic_rows) row where row->>'id'=licence_truck::text and row->>'assigned_driver_id' is distinct from synthetic_driver::text)
  then raise exception 'UNVALIDATED_DRIVER_ON_PUBLIC_ROSTER';end if;
 if basic_rows::text~'current_route|area_boundary|location_lat|location_lng|recipient_email|storage_path' then raise exception 'PRIVATE_SIGNAL_IN_BASIC_ROSTER';end if;
 select row into featured_row from public.public_featured_provider_candidates(array[(select page.base_region_code from public.company_pages page where page.organization_id=org)]) row
  where row->>'provider_organization_id'=org::text;
 if featured_row is not null and(featured_row->>'fleet_size')::integer<>(summary->>'total')::integer then raise exception 'FEATURED_DRAFT_COUNT_LEAK';end if;
 perform public.set_provider_capacity_sharing(owner_id,licence_truck,'PRIVATE');
 if public.provider_fleet_authority_summary(org,null)<>summary then raise exception 'PRIVATE_SHARING_CHANGED_PUBLIC_BASIC_COUNT';end if;
 if exists(select 1 from public.public_capacity_page(license_query,null,null,14)) then raise exception 'PRIVATE_SIGNAL_PUBLICLY_DISCLOSED';end if;
 if not exists(select 1 from public.account_capacity_filtered_page(broker_actor,repeat('6',64),null,null,100,license_query)) then raise exception 'PRIVATE_AUTHORIZED_SIGNAL_LOST';end if;
 begin
  perform public.set_provider_capacity_sharing(owner_id,licence_truck,'EXCLUSIVE','authority-recipient@example.test',repeat('6',64));
  raise exception 'RETIRED_EXCLUSIVE_EMAIL_ALLOWED';
 exception when others then if sqlerrm<>'EMAIL_CAPACITY_RETIRED' then raise;end if;end;
 if public.provider_fleet_authority_summary(org,null)<>summary or exists(select 1 from public.public_capacity_page(license_query,null,null,14)) then raise exception 'PRIVATE_SHARING_PUBLIC_LEAK';end if;
 perform public.set_provider_capacity_sharing(owner_id,licence_truck,'BOTH');
 update public.organizations set content_hidden=true where id=org;
 if(public.provider_fleet_authority_summary(org,null)->>'total')::integer<>0 or public.public_provider_fleet_page(org,null,1) is not null then raise exception 'HIDDEN_OWNER_COUNT_LEAK';end if;
 update public.organizations set content_hidden=false,review_workspace=true where id=org;
 if(public.provider_fleet_authority_summary(org,null)->>'total')::integer<>0 or public.public_provider_fleet_page(org,null,1) is not null then raise exception 'REVIEW_OWNER_COUNT_LEAK';end if;
 update public.organizations set review_workspace=false,public_visibility='PRIVATE' where id=org;
 if(public.provider_fleet_authority_summary(org,null)->>'total')::integer<>0 or public.public_provider_fleet_page(org,null,1) is not null then raise exception 'PRIVATE_PROFILE_COUNT_LEAK';end if;
 update public.organizations set public_visibility='PUBLIC' where id=org;
 update public.vehicles set plate='AUTHORITY-FIN-CHANGED' where id=licence_truck;
 if(public.managed_provider_publication_eligibility(owner_id)->>'canPublish')::boolean then raise exception 'IDENTITY_CHANGE_INHERITED_REVIEW';end if;
 update public.vehicles set plate='AUTHORITY-FIN' where id=licence_truck;
 update public.verification_requests set expires_on=current_date-1 where id=licence_source;
 if(public.managed_provider_publication_eligibility(owner_id)->>'canPublish')::boolean then raise exception 'EXPIRED_SOURCE_QUALIFIED';end if;
 if public.capacity_search_matches(licence_item,license_query) or exists(select 1 from public.public_capacity_page(license_query,null,null,14)) then raise exception 'EXPIRED_LICENCE_FILTER_MATCHED';end if;
 if exists(select 1 from public.account_capacity_filtered_page(broker_actor,repeat('6',64),null,null,100,license_query))
  then raise exception 'PRIVATE_QUALIFIER_EXPIRY_BYPASS';end if;
 if not exists(select 1 from public.capacities where id=capacity_id) or not exists(select 1 from public.account_capacity_grants where vehicle_id=licence_truck and revoked_at is null)
  then raise exception 'QUALIFICATION_LOSS_DELETED_HISTORY_OR_RECIPIENTS';end if;
 if exists(select 1 from pg_class c where c.oid='public.provider_vehicle_authority_reviews'::regclass and not c.relrowsecurity)
  or has_table_privilege('anon','public.provider_vehicle_authority_reviews','SELECT')
  or has_table_privilege('authenticated','public.provider_vehicle_authority_reviews','INSERT')
  or has_function_privilege('authenticated','public.confirm_provider_vehicle_authority(uuid,uuid,jsonb)','EXECUTE')
  or has_function_privilege('anon','public.provider_vehicle_authority_states(uuid[])','EXECUTE') then raise exception 'BROWSER_AUTHORITY_BYPASS';end if;
 raise notice 'PASS: exact reviewed facts, legacy/declaration denial, Draft qualification, LIVE gate, permission-only denial, financed licence, whole-fleet paging, identity/expiry loss, terminal history, browser denial';
end $test$;
rollback;
