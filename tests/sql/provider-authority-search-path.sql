-- FEAT-SEC/VER-001: migration181 fixes resolution only, not reviewed authority.
-- Disposable local clone only. Every identity, document and shadow is rolled back.
begin;

do $metadata$
declare helper pg_catalog.pg_proc%rowtype;rows_view pg_catalog.pg_class%rowtype;column_names text[];column_types oid[];
begin
 select * into strict helper from pg_catalog.pg_proc
 where oid='public.current_provider_vehicle_authority()'::pg_catalog.regprocedure;
 if helper.proconfig is distinct from array['search_path=pg_catalog']::text[]
 then raise exception 'AUTHORITY_FIXED_SEARCH_PATH_REQUIRED';end if;
 -- Exact original146 body, not pg_get_functiondef (which includes the new SET).
 if pg_catalog.md5(helper.prosrc)<>'746a9edefacb523e50e78228480a2bd4'
 then raise exception 'AUTHORITY_SEARCH_PATH_REPAIR_CHANGED_BODY';end if;
 if helper.proowner<>'postgres'::pg_catalog.regrole or helper.prosecdef
  or helper.provolatile<>'s' or helper.prolang<>(select oid from pg_catalog.pg_language where lanname='sql')
  or helper.pronargs<>0 or not helper.proretset or helper.prorettype<>'record'::pg_catalog.regtype
  or helper.proargnames is distinct from array['review_id','source_request_id','vehicle_id','organization_id',
   'provider_profile_id','fact_kind','holder_basis','reviewed_at','expires_on']::text[]
  or helper.proargmodes is distinct from array['t','t','t','t','t','t','t','t','t']::"char"[]
  or helper.proallargtypes is distinct from array['uuid'::pg_catalog.regtype::oid,'uuid'::pg_catalog.regtype::oid,
   'uuid'::pg_catalog.regtype::oid,'uuid'::pg_catalog.regtype::oid,'uuid'::pg_catalog.regtype::oid,
   'text'::pg_catalog.regtype::oid,'text'::pg_catalog.regtype::oid,
   'timestamp with time zone'::pg_catalog.regtype::oid,'date'::pg_catalog.regtype::oid]
 then raise exception 'AUTHORITY_SEARCH_PATH_REPAIR_CHANGED_CONTRACT';end if;
 if helper.proacl is distinct from array['postgres=X/postgres'::pg_catalog.aclitem]
  or exists(select 1 from pg_catalog.aclexplode(coalesce(helper.proacl,pg_catalog.acldefault('f',helper.proowner))) a
   where a.grantee<>helper.proowner)
 then raise exception 'AUTHORITY_SEARCH_PATH_REPAIR_CHANGED_ACL';end if;
 if exists(select 1 from unnest(array['anon','authenticated','service_role']) roles(name)
  where pg_catalog.has_function_privilege(roles.name,helper.oid,'EXECUTE'))
 then raise exception 'AUTHORITY_HELPER_APP_EXECUTE_ALLOWED';end if;
 select * into strict rows_view from pg_catalog.pg_class
 where oid='public.current_provider_vehicle_authority_rows'::pg_catalog.regclass;
 select array_agg(a.attname::text order by a.attnum),array_agg(a.atttypid order by a.attnum)
 into column_names,column_types from pg_catalog.pg_attribute a
 where a.attrelid=rows_view.oid and a.attnum>0 and not a.attisdropped;
 if rows_view.relkind<>'v' or rows_view.relowner<>helper.proowner
  or rows_view.reloptions is distinct from array['security_invoker=true']::text[]
  or column_names is distinct from helper.proargnames or column_types is distinct from helper.proallargtypes
 then raise exception 'AUTHORITY_PRIVATE_INVOKER_VIEW_CONTRACT_REQUIRED';end if;
 if exists(select 1 from pg_catalog.aclexplode(coalesce(rows_view.relacl,pg_catalog.acldefault('r',rows_view.relowner))) a
   where a.grantee<>rows_view.relowner)
  or exists(select 1 from pg_catalog.pg_attribute col cross join lateral pg_catalog.aclexplode(col.attacl) a
   where col.attrelid=rows_view.oid and col.attnum>0 and a.grantee<>rows_view.relowner)
  or exists(select 1 from unnest(array['anon','authenticated','service_role']) roles(name)
   where pg_catalog.has_table_privilege(roles.name,rows_view.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or pg_catalog.has_any_column_privilege(roles.name,rows_view.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
 then raise exception 'AUTHORITY_PRIVATE_VIEW_TABLE_OR_COLUMN_GRANT';end if;
end $metadata$;

-- Multiset parity catches missing and duplicate facts, not just equal row counts.
create function pg_temp.authority_path_rows_match(vehicle_ids uuid[])
returns void language plpgsql set search_path=pg_catalog as $$
begin
 if exists(
  (select * from public.current_provider_vehicle_authority_rows where vehicle_id=any(vehicle_ids)
   except all select * from public.current_provider_vehicle_authority() where vehicle_id=any(vehicle_ids))
  union all
  (select * from public.current_provider_vehicle_authority() where vehicle_id=any(vehicle_ids)
   except all select * from public.current_provider_vehicle_authority_rows where vehicle_id=any(vehicle_ids))
 ) then raise exception 'AUTHORITY_PRIVATE_VIEW_HELPER_MULTISET_DRIFT';end if;
end $$;

do $behavior$
declare owner_id uuid:=gen_random_uuid();reviewer uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();
 foreign_owner uuid:=gen_random_uuid();foreign_provider uuid:=gen_random_uuid();fixture_owner uuid;
 truck uuid;source_id uuid;review_id uuid;fact text;fact_kind text;category text;command jsonb;vehicle_ids uuid[]:='{}';
 baseline jsonb;under_shadow jsonb;old_path text:=current_setting('search_path');
 shadow_schema text:='authority_shadow_'||replace(gen_random_uuid()::text,'-','');shadow_now timestamptz;
 today date:=(pg_catalog.now() at time zone 'Africa/Addis_Ababa')::date;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
  (owner_id,'authority-path-'||owner_id||'@example.test',pg_catalog.now(),'{}','{}'),
  (reviewer,'authority-path-'||reviewer||'@example.test',pg_catalog.now(),'{}','{}'),
  (foreign_owner,'authority-path-'||foreign_owner||'@example.test',pg_catalog.now(),'{}','{}');
 update public.profiles set role='DRIVER',active=true,drives_truck=false where id in(owner_id,foreign_owner);
 insert into public.provider_profiles(id,user_id,business_name,handle)
 values(provider,owner_id,'Synthetic search-path provider','authority-path-'||owner_id),
  (foreign_provider,foreign_owner,'Synthetic foreign search-path provider','authority-path-'||foreign_owner);
 perform public.accept_content_policy(owner_id,'2026-10-09');
 perform public.accept_content_policy(foreign_owner,'2026-10-09');
 update public.profiles set role='SUPPORT',active=true where id=reviewer;
 insert into public.support_agent_profiles(user_id,active,available,max_open_conversations,
  can_manage_support,can_manage_customers,can_manage_operations,can_manage_brokerage,
  can_manage_featured,can_manage_billing,can_manage_trust)
 values(reviewer,true,false,3,false,false,false,false,false,false,true);
 if not public.managed_actor_has_permission(reviewer,'TRUST') then raise exception 'AUTHORITY_PATH_TRUST_SETUP_FAILED';end if;
 foreach fact in array array['OWNERSHIP','PERMISSION','OPERATING_LICENCE','EXPIRED_PERMISSION',
  'REVOKED_PERMISSION','CHANGED_IDENTITY','FOREIGN_OWNERSHIP'] loop
  fact_kind:=case when fact like '%PERMISSION' then 'PERMISSION'
   when fact='OPERATING_LICENCE' then fact else 'OWNERSHIP' end;
  fixture_owner:=case when fact='FOREIGN_OWNERSHIP' then foreign_owner else owner_id end;
  category:=case fact_kind when 'OWNERSHIP' then 'VEHICLE_OWNERSHIP'
   when 'OPERATING_LICENCE' then 'VEHICLE_OPERATING_LICENSE' else 'VEHICLE_AUTHORIZATION' end;
  truck:=(public.create_provider_vehicle(fixture_owner,jsonb_build_object('make','Synthetic','model','Search-path fixture',
   'plate','PATH-'||fact||'-'||left(owner_id::text,8),'cargo_configuration','Mini Box Truck',
   'use_basis',case fact_kind when 'OWNERSHIP' then 'OWNED' when 'OPERATING_LICENCE' then 'FINANCED' else 'PERMISSION' end))->>'id')::uuid;
  vehicle_ids:=array_append(vehicle_ids,truck);
  command:=jsonb_strip_nulls(jsonb_build_object('subject_type','VEHICLE','subject_id',truck,'related_vehicle_id',truck,
   'verification_type',category,'document_name','Synthetic search-path evidence',
   'storage_path','supabase://verification/verification/authority-path-'||truck||'.pdf',
   'original_name','authority-path.pdf','mime_type','application/pdf',
   'expires_on',case when fact_kind<>'OWNERSHIP' then (today+30)::text end));
  source_id:=public.submit_managed_verification(fixture_owner,command);
  perform public.review_managed_verification(reviewer,source_id,'APPROVED','Synthetic exact evidence review.');
  review_id:=public.confirm_provider_vehicle_authority(reviewer,source_id,jsonb_strip_nulls(jsonb_build_object(
   'fact_kind',fact_kind,
   'holder_basis',case when fact='OPERATING_LICENCE' then 'FINANCED' end,
   'expires_on',case when fact_kind<>'OWNERSHIP' then (today+30)::text end,
   'review_note','Synthetic exact beneficiary matched.',
   'context_revision',public.managed_provider_authority_review_context(reviewer,array[source_id])->0->>'contextRevision')));
  -- Model an elapsed approved source; keep the current reviewed fact intact.
  if fact='EXPIRED_PERMISSION' then update public.verification_requests set expires_on=today-1 where id=source_id;end if;
  if fact='REVOKED_PERMISSION' then
   perform public.revoke_provider_vehicle_authority(reviewer,review_id,'Synthetic revoked beneficiary permission.');
  end if;
  if fact='CHANGED_IDENTITY' then update public.vehicles set plate=plate||'-CHANGED' where id=truck;end if;
 end loop;
 select jsonb_agg(to_jsonb(a) order by a.review_id) into baseline
 from public.current_provider_vehicle_authority() a where a.vehicle_id=any(vehicle_ids);
 if jsonb_array_length(baseline)<>4 or exists(
  select 1 from public.current_provider_vehicle_authority() a where a.vehicle_id=any(vehicle_ids[4:6]))
  or not exists(select 1 from public.current_provider_vehicle_authority() a
   where a.vehicle_id=vehicle_ids[7] and a.provider_profile_id=foreign_provider)
 then raise exception 'AUTHORITY_PATH_VALID_EXPIRED_REVOKED_CHANGED_FOREIGN_FIXTURES_REQUIRED';end if;
 perform pg_temp.authority_path_rows_match(vehicle_ids);
 execute format('create schema %I',shadow_schema);
 execute format('create function %I.now() returns timestamptz language sql stable as %L',
  shadow_schema,'select ''2100-01-01 00:00:00+00''::timestamptz');
 perform pg_catalog.set_config('search_path',format('%I,pg_catalog,public',shadow_schema),true);
 execute 'select now()' into shadow_now;
 if shadow_now is distinct from '2100-01-01 00:00:00+00'::timestamptz
 then raise exception 'AUTHORITY_PATH_ATTACK_FIXTURE_NOT_ACTIVE';end if;
 execute 'select jsonb_agg(to_jsonb(a) order by a.review_id) from public.current_provider_vehicle_authority() a where a.vehicle_id=any($1)'
 into under_shadow using vehicle_ids;
 if under_shadow is distinct from baseline then raise exception 'AUTHORITY_INHERITED_CALLER_NOW_SHADOW';end if;
 perform pg_temp.authority_path_rows_match(vehicle_ids);
 perform pg_catalog.set_config('search_path',old_path,true);
end $behavior$;

set local role anon;
do $$ begin
 begin perform 1 from public.current_provider_vehicle_authority();raise exception 'AUTHORITY_ANON_EXECUTE_ALLOWED';
 exception when insufficient_privilege then null;end;
 begin perform * from public.current_provider_vehicle_authority_rows;raise exception 'AUTHORITY_ANON_VIEW_SELECT_ALLOWED';
 exception when insufficient_privilege then null;end;
 begin perform review_id from public.current_provider_vehicle_authority_rows;raise exception 'AUTHORITY_ANON_VIEW_COLUMN_SELECT_ALLOWED';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin perform 1 from public.current_provider_vehicle_authority();raise exception 'AUTHORITY_AUTH_EXECUTE_ALLOWED';
 exception when insufficient_privilege then null;end;
 begin perform * from public.current_provider_vehicle_authority_rows;raise exception 'AUTHORITY_AUTH_VIEW_SELECT_ALLOWED';
 exception when insufficient_privilege then null;end;
 begin perform review_id from public.current_provider_vehicle_authority_rows;raise exception 'AUTHORITY_AUTH_VIEW_COLUMN_SELECT_ALLOWED';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
do $$ begin
 begin perform 1 from public.current_provider_vehicle_authority();raise exception 'AUTHORITY_SERVICE_EXECUTE_ALLOWED';
 exception when insufficient_privilege then null;end;
 begin perform * from public.current_provider_vehicle_authority_rows;raise exception 'AUTHORITY_SERVICE_VIEW_SELECT_ALLOWED';
 exception when insufficient_privilege then null;end;
 begin perform review_id from public.current_provider_vehicle_authority_rows;raise exception 'AUTHORITY_SERVICE_VIEW_COLUMN_SELECT_ALLOWED';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
