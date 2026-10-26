-- FEAT-FTR-001 / NR-67. Current080+146 contract, not a new publication exception.
-- Disposable isolated restore only: identities, reviews, days and history roll back.
begin;

-- Compose the actual public candidate/link/identity boundaries used by Featured;
-- do not replace their eligibility logic with fixture constants.
create function pg_temp.featured_visible_saved_pairs(requested_day uuid)
returns table(slot_position integer,vehicle_id uuid,driver_user_id uuid)
language sql stable set search_path=pg_catalog as $$
 select s.slot_position,s.vehicle_id,s.driver_user_id
 from public.featured_provider_days d join public.featured_provider_slots s on s.day_id=d.id
 join public.vehicles v on v.id=s.vehicle_id
 cross join lateral public.featured_eligible_truck_links(array(
  select jsonb_array_elements_text(public.featured_truck_theme(d.feature_date)->'configurations'))) link
 cross join lateral public.public_featured_provider_candidates(array['ADDIS_ABABA']) candidate
 cross join lateral public.public_person_identities(array[s.driver_user_id]) identity
 where d.id=requested_day and d.status='PUBLISHED'
  and link.vehicle_id=s.vehicle_id and link.driver_user_id=s.driver_user_id
  and identity.id=s.driver_user_id and (candidate->>'eligible')::boolean
  and ((candidate->>'provider_organization_id')::uuid=v.organization_id
    or (candidate->>'provider_profile_id')::uuid=v.provider_profile_id)
$$;

do $test$
declare owner_id uuid:=gen_random_uuid();reviewer uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();
 truck uuid;other_truck uuid;source_id uuid;review_id uuid;day_id uuid;manual_id uuid;
 feature_day date:='2197-05-14';today date:=(pg_catalog.now() at time zone 'Africa/Addis_Ababa')::date;
 theme jsonb;candidate jsonb;fleet jsonb;state jsonb;command jsonb;saved_before jsonb;history_before jsonb;manual_before jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)values
  (owner_id,'featured-optional-'||owner_id||'@example.test',pg_catalog.now(),'{}','{"full_name":"Synthetic PrivateFather"}'),
  (reviewer,'featured-optional-'||reviewer||'@example.test',pg_catalog.now(),'{}','{}');
 update public.profiles set role='DRIVER',active=true,drives_truck=true,
  first_name='Synthetic',last_name='PrivateFather',public_callback_phone='+251900000080',public_callback_phone_configured=true
 where id=owner_id;
 update public.profiles set role='SUPPORT',active=true where id=reviewer;
 insert into public.support_agent_profiles(user_id,active,available,max_open_conversations,
  can_manage_support,can_manage_customers,can_manage_operations,can_manage_brokerage,
  can_manage_featured,can_manage_billing,can_manage_trust)
 values(reviewer,true,false,3,false,false,false,false,true,false,true);
 insert into public.provider_profiles(id,user_id,business_name,handle,city,city_place_ref,public_visibility,
  verified_identity,verified_license,vehicle_documents_verified)
 values(provider,owner_id,'Demo Synthetic','featured-optional-'||owner_id,'Addis Ababa',
  (select id from public.place_catalog where normalized_name='addis ababa'order by id limit 1),'PUBLIC',false,false,false);
 insert into public.company_pages(provider_profile_id,account_name,published,base_region_code,contact_phone,show_contact_phone)
 values(provider,'Demo Synthetic',true,'ADDIS_ABABA','+251900000080',true);
 perform public.accept_content_policy(owner_id,'2026-10-09');
 while exists(select 1 from public.featured_provider_days where feature_date in(feature_day,feature_day+1))loop
  feature_day:=feature_day+7;
 end loop;
 theme:=public.featured_truck_theme(feature_day);
 truck:=(public.create_provider_vehicle(owner_id,jsonb_build_object('make','Synthetic','model','Optional Featured',
  'plate','FTR-OPTIONAL-'||left(owner_id::text,8),'cargo_configuration',theme->'configurations'->>0,'use_basis','OWNED'))->>'id')::uuid;
 insert into public.driver_vehicle_assignments(driver_user_id,vehicle_id,active)values(owner_id,truck,true);
 perform public.set_provider_vehicle_publication(owner_id,truck,'LIVE');
 if exists(select 1 from public.verification_requests where submitted_by=owner_id)
 then raise exception 'OPTIONAL_FEATURED_FIXTURE_HAS_DOCUMENTS';end if;
 select row into strict candidate from public.public_featured_provider_candidates(array['ADDIS_ABABA'])row
 where row->>'provider_profile_id'=provider::text;
 if not(candidate->>'eligible')::boolean then raise exception 'ONE_LIVE_UNREVIEWED_FEATURED_EXCLUDED';end if;
 if candidate::text like '%PrivateFather%'or candidate::text like '%@example.test%'
 then raise exception 'OPTIONAL_FEATURED_PRIVATE_IDENTITY_LEAK';end if;
 fleet:=public.public_provider_fleet_page(null,provider,1);
 if jsonb_array_length(fleet->'items')<>1 then raise exception 'UNREVIEWED_PUBLIC_FLEET_MISSING';end if;
 state:=fleet->'items'->0->'authority';
 if(state->'ownership'->>'verified')::boolean or(state->'permission'->>'verified')::boolean
  or(state->'operatingLicence'->>'verified')::boolean or(state->>'qualifiesProvider')::boolean
 then raise exception 'MISSING_DOCUMENT_AWARDED_PUBLIC_AUTHORITY';end if;

 day_id:=public.save_managed_featured_truck_day(reviewer,jsonb_build_object('feature_date',feature_day,
  'theme_key',theme->>'key','theme_label',theme->>'label','theme_configurations',theme->'configurations',
  'target_count',1,'truck_keys',jsonb_build_array('vehicle:'||truck),'publish',true,'schedule_mode','AUTO',
  'schedule_config',jsonb_build_object('dayStart','22:30','dayEnd','23:59','targetCount',1,'sponsorBreakCount',4,'sponsorBreakMinutes',2)));
 -- Model only this newly created saved AUTO day, never alter an existing roster.
 update public.featured_provider_days set selection_source='AUTO'where id=day_id;
 insert into public.featured_theme_rotation_selections(primary_theme_key,round_number,vehicle_id,driver_user_id,first_feature_date,featured_day_id)
 values(public.featured_truck_primary_theme(theme->'configurations'->>0),1,truck,owner_id,feature_day,day_id);
 manual_id:=public.save_managed_featured_truck_day(reviewer,jsonb_build_object('feature_date',feature_day+1,
  'theme_key',public.featured_truck_theme(feature_day+1)->>'key','theme_label',public.featured_truck_theme(feature_day+1)->>'label',
  'theme_configurations',public.featured_truck_theme(feature_day+1)->'configurations','target_count',1,
  'truck_keys','[]'::jsonb,'publish',false,'schedule_mode','AUTO','schedule_config',jsonb_build_object(
   'dayStart','22:30','dayEnd','23:59','targetCount',1,'sponsorBreakCount',4,'sponsorBreakMinutes',2)));
 select jsonb_build_object('day',to_jsonb(d),'slots',(select jsonb_agg(to_jsonb(s)order by s.slot_position)
  from public.featured_provider_slots s where s.day_id=d.id))into saved_before from public.featured_provider_days d where d.id=day_id;
 select to_jsonb(d)into manual_before from public.featured_provider_days d where d.id=manual_id;
 select jsonb_agg(to_jsonb(h)order by h.primary_theme_key,h.round_number)into history_before
 from public.featured_theme_rotation_selections h where h.vehicle_id=truck;
 if(select count(*)from pg_temp.featured_visible_saved_pairs(day_id))<>1
 then raise exception 'UNREVIEWED_SAVED_PUBLIC_FEATURED_MISSING';end if;

 other_truck:=(public.create_provider_vehicle(owner_id,jsonb_build_object('make','Synthetic','model','Additional unreviewed',
  'plate','FTR-SECOND-'||left(owner_id::text,8),'cargo_configuration',theme->'configurations'->>0,'use_basis','PERMISSION'))->>'id')::uuid;
 begin
  perform public.set_provider_vehicle_publication(owner_id,other_truck,'LIVE');
  raise exception 'UNQUALIFIED_ADDITIONAL_PUBLICATION_ALLOWED';
 exception when raise_exception then
  if sqlerrm<>'PROVIDER_VERIFICATION_REQUIRED'then raise;end if;
 end;
 -- Retained pre146 legacy LIVE state must not bypass current fleet qualification.
 update public.vehicles set publication_status='LIVE'where id=other_truck;
 select row into strict candidate from public.public_featured_provider_candidates(array['ADDIS_ABABA'])row
 where row->>'provider_profile_id'=provider::text;
 if(candidate->>'eligible')::boolean or exists(select 1 from pg_temp.featured_visible_saved_pairs(day_id))
 then raise exception 'UNQUALIFIED_FLEET_SAVED_FEATURED_VISIBLE';end if;
 if jsonb_array_length(public.public_provider_fleet_page(null,provider,1)->'items')<>0
 then raise exception 'UNQUALIFIED_FLEET_PUBLIC_DETAIL_VISIBLE';end if;
 perform public.set_provider_vehicle_publication(owner_id,other_truck,'DRAFT');
 if(select count(*)from pg_temp.featured_visible_saved_pairs(day_id))<>1
 then raise exception 'LEGITIMATE_SINGLE_LIVE_SAVED_FEATURED_NOT_RECOVERED';end if;

 -- Fictional isolated reviews exercise truthful badge expiry/revocation only.
 -- They are not required for one-LIVE eligibility and never reach production.
 command:=jsonb_build_object('subject_type','VEHICLE','subject_id',truck,'verification_type','VEHICLE_OWNERSHIP',
  'document_name','Fictional rollback Featured evidence','storage_path','supabase://verification/verification/featured-optional-fixture.pdf',
  'original_name','fixture.pdf','mime_type','application/pdf','expires_on',today+30);
 for ordinal in 1..2 loop
  source_id:=public.submit_managed_verification(owner_id,command);
  perform public.review_managed_verification(reviewer,source_id,'APPROVED','Fictional isolated review, never legal evidence.');
  review_id:=public.confirm_provider_vehicle_authority(reviewer,source_id,jsonb_build_object('fact_kind','OWNERSHIP',
   'review_note','Fictional isolated authority, never legal evidence.',
   'context_revision',public.managed_provider_authority_review_context(reviewer,array[source_id])->0->>'contextRevision'));
  if not(public.provider_vehicle_authority_state(truck)->'ownership'->>'verified')::boolean
  then raise exception 'REVIEWED_FIXTURE_AUTHORITY_MISSING';end if;
  if ordinal=1 then
   perform public.revoke_provider_vehicle_authority(reviewer,review_id,'Fictional review revoked in rollback test.');
  else
   update public.verification_requests set expires_on=today-1 where id=source_id;
  end if;
  state:=public.public_provider_fleet_page(null,provider,1)->'items'->0->'authority';
  if(state->'ownership'->>'verified')::boolean then raise exception 'REVOKED_OR_EXPIRED_PUBLIC_BADGE_STALE';end if;
  if(select count(*)from pg_temp.featured_visible_saved_pairs(day_id))<>1
  then raise exception 'OPTIONAL_DOCUMENT_LOSS_REMOVED_SINGLE_LIVE_FEATURED';end if;
 end loop;

 if saved_before is distinct from(select jsonb_build_object('day',to_jsonb(d),'slots',(
   select jsonb_agg(to_jsonb(s)order by s.slot_position)from public.featured_provider_slots s where s.day_id=d.id))
   from public.featured_provider_days d where d.id=day_id)
  or manual_before is distinct from(select to_jsonb(d)from public.featured_provider_days d where d.id=manual_id)
  or history_before is distinct from(select jsonb_agg(to_jsonb(h)order by h.primary_theme_key,h.round_number)
   from public.featured_theme_rotation_selections h where h.vehicle_id=truck)
 then raise exception 'ELIGIBILITY_RECOVERY_REWROTE_SAVED_OR_MANUAL_OR_ROUND_HISTORY';end if;
 raise notice 'PASS: optional-doc one-LIVE public projection, truthful badges, multi-LIVE denial and exact saved AUTO recovery preserve manual/history';
end $test$;
rollback;
