-- FEAT-SIM-001 / NR-83. Synthetic records only, always rolled back.
begin;
set local search_path=public,pg_catalog,pg_temp;
do $test$
declare
 pilot uuid:=gen_random_uuid();
 ordinary uuid:=gen_random_uuid();
 personal uuid:=gen_random_uuid();
 fleet uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
 values
 (pilot,'example-pilot-'||pilot||'@example.test',now(),'{"fixture_source":"loadgistic-production-pilot-v1"}','{}'),
 (ordinary,'example-ordinary-'||ordinary||'@example.test',now(),'{}','{"fixture_source":"loadgistic"}');
 update profiles set active=true,role='DRIVER' where id in(pilot,ordinary);
 insert into provider_profiles(id,user_id,business_name,handle)
  values(personal,pilot,'Example personal provider','example-'||personal);
 insert into organizations(id,name,handle,type)
  values(fleet,'Example fleet','example-'||fleet,'TRANSPORT_COMPANY');
 insert into organization_members(organization_id,user_id,membership_role)
  values(fleet,pilot,'OWNER');
 if (capacity_owner_documents(array[fleet],array[]::uuid[])->0->'account_is_demo') is distinct from 'true'::jsonb
  or (capacity_owner_documents(array[]::uuid[],array[personal])->0->'account_is_demo') is distinct from 'true'::jsonb then
  raise exception 'EXAMPLE_PILOT_LABEL_MISSING';
 end if;
 insert into organization_members(organization_id,user_id,membership_role)
  values(fleet,ordinary,'OWNER');
 if (capacity_owner_documents(array[fleet],array[]::uuid[])->0->'account_is_demo') is distinct from 'false'::jsonb then
  raise exception 'EXAMPLE_LABEL_MIXED_OWNERS';
 end if;
 if has_function_privilege('anon','public.capacity_owner_documents(uuid[],uuid[])','execute')
   or has_function_privilege('authenticated','public.capacity_owner_documents(uuid[],uuid[])','execute') then
   raise exception 'EXAMPLE_ACCOUNT_PUBLIC_RPC';
 end if;
end $test$;
rollback;
