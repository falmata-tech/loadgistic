-- FEAT-FLT/VER/CAP-001 / ADR-079. Actual commands, synthetic and rollback-only.
begin;
create function pg_temp.live_slot_assert(ok boolean,label text)returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'PROVIDER_LIVE_SLOT_ASSERT: %',label;end if;end $$;
create function pg_temp.live_slot_denied(command text,expected text)returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'PROVIDER_LIVE_SLOT_DENIAL_MISSING: %',expected;
end $$;
do $test$
declare owner_id uuid:=gen_random_uuid();provider_id uuid:=gen_random_uuid();foreign_owner uuid:=gen_random_uuid();
 foreign_provider uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();admin_id uuid;unknown_scope uuid:=gen_random_uuid();
 truck_a uuid;truck_b uuid;qualifier_truck uuid;permission_source uuid;title_source uuid;licence_source uuid;
 permission_review uuid;title_review uuid;licence_review uuid;command jsonb;eligibility jsonb;terminal_title jsonb;before_audits bigint;
begin
 select id into strict admin_id from public.profiles where role='ADMIN' and active order by id limit 1;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)values
 (owner_id,'live-slot-'||owner_id||'@example.test',now(),'{}','{}'),
 (foreign_owner,'live-slot-'||foreign_owner||'@example.test',now(),'{}','{}'),
 (employee,'live-slot-'||employee||'@example.test',now(),'{}','{}');
 update public.profiles set role='DRIVER',active=true,drives_truck=false where id in(owner_id,foreign_owner);
 insert into public.provider_profiles(id,user_id,business_name,handle)values
 (provider_id,owner_id,'Synthetic Live slot provider','live-slot-'||owner_id),
 (foreign_provider,foreign_owner,'Synthetic foreign provider','live-slot-'||foreign_owner);
 perform public.accept_content_policy(owner_id,'2026-10-09');
 perform pg_temp.live_slot_assert(not public.provider_scope_can_publish(null,unknown_scope)
  and not public.provider_scope_can_publish(unknown_scope,null)
  and not public.provider_scope_can_publish(null,null)
  and not public.provider_scope_can_publish(unknown_scope,provider_id),'unknown_or_invalid_scope_cannot_get_free_slot');
 perform public.fleet_register_driver(owner_id,employee,jsonb_build_object('email','live-slot-'||employee||'@example.test','name','Synthetic assigned driver','phone','+251900000146'));
 command:=jsonb_build_object('make','Isuzu','model','Synthetic Live slot','cargo_configuration','Mini Box Truck','use_basis','PERMISSION');
 truck_a:=(public.create_provider_vehicle(owner_id,command||jsonb_build_object('plate','LIVE-A-'||left(owner_id::text,8)))->>'id')::uuid;
 truck_b:=(public.create_provider_vehicle(owner_id,command||jsonb_build_object('plate','LIVE-B-'||left(owner_id::text,8)))->>'id')::uuid;
 qualifier_truck:=(public.create_provider_vehicle(owner_id,command||jsonb_build_object('plate','LIVE-Q-'||left(owner_id::text,8),'use_basis','OWNED'))->>'id')::uuid;
 perform pg_temp.live_slot_assert((select count(*)=3 and bool_and(publication_status='DRAFT')from public.vehicles where provider_profile_id=provider_id),'all_additions_start_draft');
 eligibility:=public.managed_provider_publication_eligibility(owner_id);
 perform pg_temp.live_slot_assert((eligibility->>'canPublish')::boolean and(eligibility->>'qualifyingTruckCount')::integer=0 and(eligibility->>'liveTruckCount')::integer=0,'first_slot_requires_no_review');
 perform public.set_provider_vehicle_publication(owner_id,truck_a,'LIVE');
 perform pg_temp.live_slot_assert(public.provider_vehicle_discovery_allows(truck_a)and not public.provider_vehicle_discovery_allows(truck_b),'first_unreviewed_truck_eligible_only');
 perform pg_temp.live_slot_assert(not(public.provider_vehicle_authority_state(truck_a)->>'qualifiesProvider')::boolean,'free_slot_does_not_award_evidence');
 select count(*)into before_audits from public.audit_logs where actor_user_id=owner_id and action='PROVIDER_TRUCK_PUBLICATION_CHANGED';
 perform public.set_provider_vehicle_publication(owner_id,truck_a,'LIVE');
 perform pg_temp.live_slot_assert((select count(*)=before_audits from public.audit_logs where actor_user_id=owner_id and action='PROVIDER_TRUCK_PUBLICATION_CHANGED'),'same_live_is_idempotent');
 perform pg_temp.live_slot_denied(format('select public.set_provider_vehicle_publication(%L,%L,%L)',owner_id,truck_b,'LIVE'),'PROVIDER_VERIFICATION_REQUIRED');
 eligibility:=public.managed_provider_publication_eligibility(owner_id);
 perform pg_temp.live_slot_assert(not(eligibility->>'canPublish')::boolean and(eligibility->>'liveTruckCount')::integer=1,'one_free_slot_is_not_unlimited_publication');

 command:=jsonb_build_object('subject_type','VEHICLE','subject_id',truck_a,'related_vehicle_id',truck_a,
  'verification_type','VEHICLE_AUTHORIZATION','document_name','Synthetic drive/manage permission',
  'storage_path','supabase://verification/verification/live-slot-permission.pdf','original_name','permission.pdf','mime_type','application/pdf','expires_on',current_date+30);
 permission_source:=public.submit_managed_verification(owner_id,command);
 perform public.review_managed_verification(admin_id,permission_source,'APPROVED','Synthetic permission document reviewed.');
 permission_review:=public.confirm_provider_vehicle_authority(admin_id,permission_source,jsonb_build_object('fact_kind','PERMISSION',
  'review_note','Synthetic exact provider drive/manage permission.','expires_on',current_date+30,
  'context_revision',public.managed_provider_authority_review_context(admin_id,array[permission_source])->0->>'contextRevision'));
 perform pg_temp.live_slot_assert((public.provider_vehicle_authority_state(truck_a)->'permission'->>'verified')::boolean
  and not(public.provider_vehicle_authority_state(truck_a)->'ownership'->>'verified')::boolean,'permission_stays_distinct');
 perform pg_temp.live_slot_denied(format('select public.set_provider_vehicle_publication(%L,%L,%L)',owner_id,truck_b,'LIVE'),'PROVIDER_VERIFICATION_REQUIRED');

 command:=jsonb_build_object('subject_type','VEHICLE','subject_id',qualifier_truck,'verification_type','VEHICLE_OWNERSHIP',
  'document_name','Synthetic title','storage_path','supabase://verification/verification/live-slot-title.pdf','original_name','title.pdf','mime_type','application/pdf');
 title_source:=public.submit_managed_verification(owner_id,command);
 perform public.review_managed_verification(admin_id,title_source,'APPROVED','Synthetic title document reviewed.');
 select to_jsonb(r)into terminal_title from public.verification_requests r where id=title_source;
 perform pg_temp.live_slot_denied(format('select public.set_provider_vehicle_publication(%L,%L,%L)',owner_id,truck_b,'LIVE'),'PROVIDER_VERIFICATION_REQUIRED');
 title_review:=public.confirm_provider_vehicle_authority(admin_id,title_source,jsonb_build_object('fact_kind','OWNERSHIP',
  'review_note','Synthetic exact provider title holder matches.','context_revision',public.managed_provider_authority_review_context(admin_id,array[title_source])->0->>'contextRevision'));
 perform pg_temp.live_slot_assert((select publication_status='DRAFT'from public.vehicles where id=qualifier_truck),'draft_title_can_qualify_without_publication');
 perform public.set_provider_vehicle_publication(owner_id,truck_b,'LIVE');
 perform pg_temp.live_slot_assert(public.provider_vehicle_discovery_allows(truck_a)and public.provider_vehicle_discovery_allows(truck_b),'reviewed_title_unlocks_multiple_live_trucks');
 perform pg_temp.live_slot_assert(not(public.provider_vehicle_authority_state(truck_b)->>'qualifiesProvider')::boolean,'other_truck_does_not_inherit_ownership');
 perform public.revoke_provider_vehicle_authority(admin_id,title_review,'Synthetic title relationship revoked.');
 perform pg_temp.live_slot_assert(not public.provider_vehicle_discovery_allows(truck_a)and not public.provider_vehicle_discovery_allows(truck_b),'multi_live_fleet_withheld_after_qualifier_loss');
 perform pg_temp.live_slot_assert((select count(*)=2 from public.vehicles where provider_profile_id=provider_id and active and publication_status='LIVE'),'revocation_retains_live_choices');
 perform public.set_provider_vehicle_publication(owner_id,truck_a,'LIVE'); -- retained choice is idempotent, not eligible
 perform pg_temp.live_slot_assert(not public.provider_vehicle_discovery_allows(truck_a),'idempotent_live_does_not_bypass_read_gate');
 perform public.set_provider_vehicle_publication(owner_id,truck_b,'DRAFT');
 perform pg_temp.live_slot_assert(public.provider_vehicle_discovery_allows(truck_a)and not public.provider_vehicle_discovery_allows(truck_b),'withdrawing_to_one_restores_free_slot_visibility');

 perform public.set_vehicle_lifecycle(owner_id,truck_a,false,'Synthetic retirement frees the one Live slot.');
 perform pg_temp.live_slot_assert((public.managed_provider_publication_eligibility(owner_id)->>'liveTruckCount')::integer=0,'retired_truck_does_not_consume_live_slot');
 perform public.set_provider_vehicle_publication(owner_id,truck_b,'LIVE');
 perform public.set_vehicle_lifecycle(owner_id,truck_a,true,'Synthetic restoration must return as Draft.');
 perform pg_temp.live_slot_assert((select active and publication_status='DRAFT'from public.vehicles where id=truck_a),'restoration_never_reclaims_live_slot');
 perform pg_temp.live_slot_assert(public.provider_vehicle_discovery_allows(truck_b)and not public.provider_vehicle_discovery_allows(truck_a),'restoration_preserves_existing_single_live_truck');
 perform pg_temp.live_slot_denied(format('select public.set_provider_vehicle_publication(%L,%L,%L)',owner_id,truck_a,'LIVE'),'PROVIDER_VERIFICATION_REQUIRED');

 command:=jsonb_build_object('subject_type','VEHICLE','subject_id',qualifier_truck,'verification_type','VEHICLE_OPERATING_LICENSE',
  'document_name','Synthetic financed-purchase operating licence','storage_path','supabase://verification/verification/live-slot-licence.pdf',
  'original_name','licence.pdf','mime_type','application/pdf','expires_on',current_date+30);
 licence_source:=public.submit_managed_verification(owner_id,command);
 perform public.review_managed_verification(admin_id,licence_source,'APPROVED','Synthetic operating licence document reviewed.');
 licence_review:=public.confirm_provider_vehicle_authority(admin_id,licence_source,jsonb_build_object('fact_kind','OPERATING_LICENCE','holder_basis','FINANCED',
  'review_note','Synthetic financed-purchase licence names this provider.','expires_on',current_date+30,
  'context_revision',public.managed_provider_authority_review_context(admin_id,array[licence_source])->0->>'contextRevision'));
 perform pg_temp.live_slot_assert((public.provider_vehicle_authority_state(qualifier_truck)->'operatingLicence'->>'verified')::boolean
  and not(public.provider_vehicle_authority_state(qualifier_truck)->'ownership'->>'verified')::boolean,'financed_licence_qualifies_without_ownership_claim');
 perform public.set_provider_vehicle_publication(owner_id,truck_a,'LIVE');
 perform pg_temp.live_slot_assert(public.provider_vehicle_discovery_allows(truck_a)and public.provider_vehicle_discovery_allows(truck_b),'financed_licence_unlocks_multiple_live_trucks');
 perform public.revoke_provider_vehicle_authority(admin_id,licence_review,'Synthetic financed licence relationship revoked.');
 perform pg_temp.live_slot_assert(not public.provider_vehicle_discovery_allows(truck_a)and not public.provider_vehicle_discovery_allows(truck_b),'financed_licence_revocation_withholds_multi_live_fleet');
 perform public.set_provider_vehicle_publication(owner_id,truck_a,'DRAFT');
 perform pg_temp.live_slot_assert(public.provider_vehicle_discovery_allows(truck_b),'one_unreviewed_live_remains_after_financed_review_loss');

 perform public.update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',employee,'vehicle_id',truck_b,'can_manage_capacity',true,'can_manage_tracking',true));
 perform pg_temp.live_slot_denied(format('select public.set_provider_vehicle_publication(%L,%L,%L)',foreign_owner,truck_b,'DRAFT'),'NOT_FOUND');
 perform pg_temp.live_slot_denied(format('select public.set_provider_vehicle_publication(%L,%L,%L)',employee,truck_b,'DRAFT'),'FORBIDDEN');
 perform pg_temp.live_slot_assert(public.capacity_active_driver_id(truck_b)=employee,'publication_denials_preserve_current_assignment');
 perform pg_temp.live_slot_assert((select to_jsonb(r)=terminal_title from public.verification_requests r where id=title_source),'relationship_revocation_does_not_rewrite_terminal_document');
 perform pg_temp.live_slot_assert(exists(select 1 from public.provider_vehicle_authority_reviews where id=permission_review and revoked_at is null)
  and exists(select 1 from public.provider_vehicle_authority_reviews where id=title_review and revoked_at is not null)
  and exists(select 1 from public.provider_vehicle_authority_reviews where id=licence_review and revoked_at is not null),'all_evidence_history_is_retained');
 update public.profiles set active=false where id=owner_id;
 perform pg_temp.live_slot_assert(not public.provider_scope_can_publish(null,provider_id)
  and not public.provider_vehicle_discovery_allows(truck_b),'inactive_owner_cannot_get_free_slot');
 perform pg_temp.live_slot_denied(format('select public.managed_provider_publication_eligibility(%L)',owner_id),'FORBIDDEN');
 perform pg_temp.live_slot_denied(format('select public.set_provider_vehicle_publication(%L,%L,%L)',owner_id,truck_b,'DRAFT'),'FORBIDDEN');
 update public.profiles set active=true where id=owner_id;
 update auth.users set deleted_at=clock_timestamp()where id=owner_id;
 perform pg_temp.live_slot_assert(not public.provider_scope_can_publish(null,provider_id)
  and not public.provider_vehicle_discovery_allows(truck_b),'auth_deleted_owner_cannot_get_free_slot');
 update auth.users set deleted_at=null where id=owner_id;
 perform pg_temp.live_slot_assert(public.provider_vehicle_discovery_allows(truck_b),'restored_active_account_keeps_prior_single_live_choice');
 delete from public.provider_profiles where id=foreign_provider and user_id=foreign_owner;
 perform pg_temp.live_slot_assert(not public.provider_scope_can_publish(null,foreign_provider),'deleted_provider_scope_cannot_get_free_slot');
 perform pg_temp.live_slot_denied(format('select public.managed_provider_publication_eligibility(%L)',foreign_owner),'FORBIDDEN');
 raise notice 'PASS: free first Live, blocked second, exact ownership/financed licence, permission distinction, revocation/reduction, retire/restore Draft, foreign/employee/inactive/deleted/unknown denial and preserved history';
end $test$;
rollback;
