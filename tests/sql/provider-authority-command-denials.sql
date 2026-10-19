-- FEAT-VER/FLT-001 / ADR-079: current Trust, exact source/context and expiry denials.
-- Disposable local database only. Own every fixture; retain no writes or files.
begin;

create function pg_temp.authority_command_state(truck_ids uuid[],actor_ids uuid[])
returns jsonb language sql as $$
 select jsonb_build_object(
  'sources',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb)
   from public.verification_requests r where r.subject_id=any(truck_ids) or r.related_vehicle_id=any(truck_ids)),
  'facts',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb)
   from public.provider_vehicle_authority_reviews a where a.vehicle_id=any(truck_ids)),
  'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb)
   from public.audit_logs a where a.actor_user_id=any(actor_ids))
 )
$$;

create function pg_temp.authority_command_denied(command text,expected text,truck_ids uuid[],actor_ids uuid[])
returns void language plpgsql as $$
declare before_state jsonb:=pg_temp.authority_command_state(truck_ids,actor_ids);denied boolean:=false;
begin
 begin
  execute command;
 exception when others then
  if sqlerrm is distinct from expected then raise;end if;
  denied:=true;
 end;
 if not denied then raise exception 'AUTHORITY_COMMAND_DENIAL_MISSING: %',expected;end if;
 if pg_temp.authority_command_state(truck_ids,actor_ids) is distinct from before_state
  then raise exception 'AUTHORITY_DENIAL_CHANGED_SOURCE_FACT_OR_AUDIT: %',expected;end if;
end $$;

create temporary table authority_command_fixture(
 label text primary key,owner_id uuid not null,vehicle_id uuid not null,source_id uuid not null
);

do $test$
declare owner_a uuid:=gen_random_uuid();owner_b uuid:=gen_random_uuid();provider_a uuid:=gen_random_uuid();
 provider_b uuid:=gen_random_uuid();staff_id uuid:=gen_random_uuid();actor_ids uuid[];truck_ids uuid[];
 fixture_label text;fixture_owner uuid;fact_kind text;review_status text;category text;truck uuid;source_id uuid;
 source_a uuid;source_b uuid;permission_source uuid;licence_source uuid;permission_review uuid;licence_review uuid;
 context_a text;context_b text;source_revision text;command jsonb;valid_command jsonb;context jsonb;
 today date:=(now() at time zone 'Africa/Addis_Ababa')::date;source_expiry date;expiry_value text;staff_state text;
begin
 actor_ids:=array[owner_a,owner_b,staff_id];source_expiry:=today+30;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
  (owner_a,'authority-denial-'||owner_a||'@example.test',now(),'{}','{}'),
  (owner_b,'authority-denial-'||owner_b||'@example.test',now(),'{}','{}'),
  (staff_id,'authority-denial-'||staff_id||'@example.test',now(),'{}','{}');
 update public.profiles set role='DRIVER',active=true,drives_truck=false where id in(owner_a,owner_b);
 insert into public.provider_profiles(id,user_id,business_name,handle) values
  (provider_a,owner_a,'Synthetic authority denial provider A','denial-'||owner_a),
  (provider_b,owner_b,'Synthetic authority denial provider B','denial-'||owner_b);
 perform public.accept_content_policy(owner_a,'2026-10-09');
 perform public.accept_content_policy(owner_b,'2026-10-09');
 -- Staff provisioning can assign existing waiting conversations. Directly seed
 -- only this unavailable fictional reviewer to leave other fixtures untouched.
 update public.profiles set role='SUPPORT',active=true,full_name='Synthetic authority denial reviewer' where id=staff_id;
 insert into public.support_agent_profiles(user_id,active,available,max_open_conversations,
  can_manage_support,can_manage_customers,can_manage_operations,can_manage_brokerage,
  can_manage_featured,can_manage_billing,can_manage_trust)
 values(staff_id,true,false,3,false,false,false,false,false,false,true);
 if not public.managed_actor_has_permission(staff_id,'TRUST') then raise exception 'SYNTHETIC_TRUST_SETUP_FAILED';end if;

 for fixture_label,fixture_owner,fact_kind,review_status in
  select * from (values
   ('swap-a',owner_a,'OWNERSHIP','APPROVED'),('swap-b',owner_b,'OWNERSHIP','APPROVED'),
   ('rejected',owner_a,'OWNERSHIP','REJECTED'),('more-info',owner_b,'OWNERSHIP','MORE_INFO'),
   ('permission',owner_a,'PERMISSION','APPROVED'),('licence',owner_b,'OPERATING_LICENCE','APPROVED')
  ) fixtures(label,owner_id,fact_kind,review_status)
 loop
  category:=case fact_kind when 'OWNERSHIP' then 'VEHICLE_OWNERSHIP'
   when 'PERMISSION' then 'VEHICLE_AUTHORIZATION' else 'VEHICLE_OPERATING_LICENSE' end;
  truck:=(public.create_provider_vehicle(fixture_owner,jsonb_build_object('make','Synthetic','model','Command denial',
   'plate','DENIAL-'||fixture_label||'-'||left(fixture_owner::text,8),'cargo_configuration','Mini Box Truck',
   'use_basis',case fact_kind when 'OPERATING_LICENCE' then 'FINANCED' when 'PERMISSION' then 'PERMISSION' else 'OWNED' end))->>'id')::uuid;
  command:=jsonb_strip_nulls(jsonb_build_object('subject_type','VEHICLE','subject_id',truck,'related_vehicle_id',truck,
   'verification_type',category,'document_name','Synthetic command denial '||fixture_label,
   'storage_path','supabase://verification/verification/command-denial-'||source_expiry||'-'||truck||'.pdf',
   'original_name','synthetic-command-denial.pdf','mime_type','application/pdf',
   'expires_on',case when fact_kind<>'OWNERSHIP' then source_expiry::text end));
  source_id:=public.submit_managed_verification(fixture_owner,command);
  perform public.review_managed_verification(staff_id,source_id,review_status,'Synthetic source review for command denial.');
  insert into authority_command_fixture values(fixture_label,fixture_owner,truck,source_id);
 end loop;
 select array_agg(f.vehicle_id order by f.label) into truck_ids from authority_command_fixture f;
 if exists(select 1 from public.vehicles where id=any(truck_ids) and publication_status<>'DRAFT')
  then raise exception 'DOCUMENT_DENIAL_FIXTURE_UNEXPECTEDLY_PUBLISHED';end if;
 select f.source_id into strict source_a from authority_command_fixture f where f.label='swap-a';
 select f.source_id into strict source_b from authority_command_fixture f where f.label='swap-b';
 select f.source_id into strict permission_source from authority_command_fixture f where f.label='permission';
 select f.source_id into strict licence_source from authority_command_fixture f where f.label='licence';
 context_a:=public.managed_provider_authority_review_context(staff_id,array[source_a])->0->>'contextRevision';
 context_b:=public.managed_provider_authority_review_context(staff_id,array[source_b])->0->>'contextRevision';
 if context_a is null or context_b is null or context_a=context_b then raise exception 'DISTINCT_APPROVED_SOURCE_CONTEXTS_REQUIRED';end if;

 -- Both sources have the right category and are Approved. Only the exact source
 -- context differs, in both directions and across two synthetic providers.
 valid_command:=jsonb_build_object('fact_kind','OWNERSHIP','review_note','Synthetic exact title matched.','context_revision',context_a);
 perform pg_temp.authority_command_denied(format('select public.confirm_provider_vehicle_authority(%L,%L,%L::jsonb)',
  staff_id,source_a,valid_command||jsonb_build_object('context_revision',context_b)),
  'AUTHORITY_CONTEXT_CHANGED',truck_ids,actor_ids);
 perform pg_temp.authority_command_denied(format('select public.confirm_provider_vehicle_authority(%L,%L,%L::jsonb)',
  staff_id,source_b,valid_command||jsonb_build_object('context_revision',context_a)),
  'AUTHORITY_CONTEXT_CHANGED',truck_ids,actor_ids);

 foreach fixture_label in array array['rejected','more-info'] loop
  select f.source_id into strict source_id from authority_command_fixture f where f.label=fixture_label;
  context:=public.managed_provider_authority_review_context(staff_id,array[source_id]);
  if context->0->'supportedFacts' is distinct from '[]'::jsonb then raise exception 'NONAPPROVED_SOURCE_OFFERED_AUTHORITY';end if;
  command:=valid_command||jsonb_build_object('context_revision',context->0->>'contextRevision');
  perform pg_temp.authority_command_denied(format('select public.confirm_provider_vehicle_authority(%L,%L,%L::jsonb)',
   staff_id,source_id,command),'AUTHORITY_SOURCE_NOT_APPROVED',truck_ids,actor_ids);
 end loop;

 foreach fact_kind in array array['PERMISSION','OPERATING_LICENCE'] loop
  source_id:=case fact_kind when 'PERMISSION' then permission_source else licence_source end;
  source_revision:=public.managed_provider_authority_review_context(staff_id,array[source_id])->0->>'contextRevision';
  command:=jsonb_strip_nulls(jsonb_build_object('fact_kind',fact_kind,
   'holder_basis',case when fact_kind='OPERATING_LICENCE' then 'FINANCED' end,
   'review_note','Synthetic exact beneficiary and document match.','context_revision',source_revision));
  perform pg_temp.authority_command_denied(format('select public.confirm_provider_vehicle_authority(%L,%L,%L::jsonb)',
   staff_id,source_id,command),'AUTHORITY_EXPIRY_REQUIRED',truck_ids,actor_ids);
  foreach expiry_value in array array[(today-1)::text,(source_expiry+1)::text,'not-a-date'] loop
   perform pg_temp.authority_command_denied(format('select public.confirm_provider_vehicle_authority(%L,%L,%L::jsonb)',
    staff_id,source_id,command||jsonb_build_object('expires_on',expiry_value)),
    'AUTHORITY_EXPIRY_INVALID',truck_ids,actor_ids);
  end loop;
  -- The same source/context succeeds with a valid expiry, proving the earlier
  -- denials were expiry-specific rather than a broken reviewer or source setup.
  if fact_kind='PERMISSION' then
   permission_review:=public.confirm_provider_vehicle_authority(staff_id,source_id,
    command||jsonb_build_object('expires_on',source_expiry));
  else
   licence_review:=public.confirm_provider_vehicle_authority(staff_id,source_id,
    command||jsonb_build_object('expires_on',source_expiry));
  end if;
 end loop;
 if not exists(select 1 from public.current_provider_vehicle_authority() a where a.review_id=permission_review and a.fact_kind='PERMISSION')
  or not exists(select 1 from public.current_provider_vehicle_authority() a where a.review_id=licence_review and a.fact_kind='OPERATING_LICENCE')
  then raise exception 'VALID_EXPIRY_POSITIVE_CONTROL_FAILED';end if;

 -- Simulate a form loaded while Trust was granted, then revoke current authority.
 -- Each flag changes only this synthetic reviewer; all denied commands retain
 -- every fixture source, relationship fact and audit record byte-for-byte.
 foreach staff_state in array array['TRUST_REMOVED','PROFILE_INACTIVE','STAFF_INACTIVE'] loop
  update public.profiles set active=staff_state<>'PROFILE_INACTIVE' where id=staff_id;
  update public.support_agent_profiles set active=staff_state<>'STAFF_INACTIVE',
   can_manage_trust=staff_state<>'TRUST_REMOVED' where user_id=staff_id;
  if public.managed_actor_has_permission(staff_id,'TRUST') then raise exception 'STAFF_DENIAL_STATE_NOT_INSTALLED: %',staff_state;end if;
  perform pg_temp.authority_command_denied(format('select public.managed_provider_authority_review_context(%L,ARRAY[%L]::uuid[])',
   staff_id,source_a),'FORBIDDEN',truck_ids,actor_ids);
  perform pg_temp.authority_command_denied(format('select public.confirm_provider_vehicle_authority(%L,%L,%L::jsonb)',
   staff_id,source_a,valid_command),'FORBIDDEN',truck_ids,actor_ids);
  perform pg_temp.authority_command_denied(format('select public.revoke_provider_vehicle_authority(%L,%L,%L)',
   staff_id,permission_review,'Synthetic stale reviewer must not revoke this fact.'),'FORBIDDEN',truck_ids,actor_ids);
 end loop;
 update public.profiles set active=true where id=staff_id;
 update public.support_agent_profiles set active=true,can_manage_trust=true where user_id=staff_id;
 -- Fresh authorization still permits the same confirmation and revocation.
 perform public.confirm_provider_vehicle_authority(staff_id,source_a,valid_command);
 perform public.revoke_provider_vehicle_authority(staff_id,permission_review,'Synthetic authorized revocation positive control.');
 if not exists(select 1 from public.provider_vehicle_authority_reviews where id=permission_review and revoked_at is not null)
  or not exists(select 1 from public.verification_requests where id=permission_source and status='APPROVED')
  then raise exception 'AUTHORIZED_REVOCATION_POSITIVE_CONTROL_FAILED';end if;
 raise notice 'PASS: 21 exact command denials, revoked/inactive Trust, nonapproved sources, swapped context, required/bounded expiry, unchanged source/fact/audit and positive controls';
end $test$;

rollback;
