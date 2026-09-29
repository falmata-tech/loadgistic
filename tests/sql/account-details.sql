-- Isolated Loadgistic fixtures only. Every modification rolls back.
begin;
create function pg_temp.expect_account_denied(command text,expected text) returns void language plpgsql as $$
begin
  begin execute command; exception when others then
    if sqlerrm=expected then return;end if;raise;
  end;
  raise exception 'EXPECTED_ACCOUNT_DENIAL';
end $$;
do $test$
declare actor uuid; owner_id uuid; org uuid; outsider uuid; staff uuid; admin_id uuid;
  original jsonb; unrelated jsonb; public_contacts jsonb; memberships jsonb; authorities jsonb; auth_identity jsonb;
  command jsonb; role_name text; count_before integer; n integer;
begin
  select id into strict actor from profiles where email='driver@loadgistic.local';
  select id into strict owner_id from profiles where email='transporter@loadgistic.local';
  select organization_id into strict org from organization_members where user_id=owner_id and membership_role='OWNER';
  select id into strict outsider from profiles where role='DRIVER' and id<>actor limit 1;
  select id into strict staff from profiles where email='support@loadgistic.local';
  select id into strict admin_id from profiles where email='admin@loadgistic.local';
  -- Create only a transaction-local active fleet relationship for this fixture.
  delete from drivers where user_id=actor;
  insert into drivers(user_id,organization_id,name,phone) values(actor,org,'Original Driver','+251911111111');
  insert into organization_members(organization_id,user_id,membership_role) values(org,actor,'MEMBER') on conflict do nothing;
  select to_jsonb(p)-array['full_name','phone','updated_at'] into original from profiles p where id=actor;
  select to_jsonb(p) into unrelated from profiles p where id=outsider;
  select jsonb_agg(to_jsonb(p)) into public_contacts from company_pages p;
  select jsonb_agg(to_jsonb(m)) into memberships from organization_members m;
  select jsonb_agg(to_jsonb(p)) into authorities from driver_permissions p;
  select to_jsonb(u) into auth_identity from auth.users u where id=actor;

  perform update_own_account_details(actor,'{"name":"  Edited Driver  ","phone":" +251900123456 "}');
  if not exists(select 1 from profiles where id=actor and full_name='Edited Driver' and phone='+251900123456') then raise exception 'SAVE_NOT_PERSISTED';end if;
  if not exists(select 1 from drivers where user_id=actor and name='Edited Driver' and phone='+251911111111') then raise exception 'FLEET_CALLBACK_CHANGED';end if;
  if (select to_jsonb(p)-array['full_name','phone','updated_at'] from profiles p where id=actor)<>original then raise exception 'AUTHORITY_CHANGED';end if;
  if (select to_jsonb(p) from profiles p where id=outsider)<>unrelated then raise exception 'OTHER_ACCOUNT_CHANGED';end if;
  if (select jsonb_agg(to_jsonb(p)) from company_pages p) is distinct from public_contacts then raise exception 'PUBLIC_CONTACT_CHANGED';end if;
  if (select jsonb_agg(to_jsonb(m)) from organization_members m) is distinct from memberships then raise exception 'MEMBERSHIP_CHANGED';end if;
  if (select jsonb_agg(to_jsonb(p)) from driver_permissions p) is distinct from authorities then raise exception 'PERMISSIONS_CHANGED';end if;
  if (select to_jsonb(u) from auth.users u where id=actor)<>auth_identity then raise exception 'AUTH_IDENTITY_CHANGED';end if;

  perform fleet_update_driver_contact(owner_id,jsonb_build_object('driver_user_id',actor,'name','Fleet correction','phone','+251922222222'));
  if (select phone from profiles where id=actor)<>'+251900123456' then raise exception 'OWNER_OVERWROTE_PRIVATE_PHONE';end if;
  perform update_own_account_details(actor,'{"name":"Edited Driver","phone":""}');
  if (select phone from profiles where id=actor) is not null then raise exception 'CLEAR_PHONE_FAILED';end if;

  select count(*) into count_before from audit_logs where action='ACCOUNT_DETAILS_UPDATED' and actor_user_id=actor;
  foreach command in array array[
    'null'::jsonb,'[]'::jsonb,'{}'::jsonb,'{"name":"x","phone":""}'::jsonb,
    '{"name":"Valid","phone":"-------"}'::jsonb,'{"name":"Valid","phone":1234567}'::jsonb,
    '{"name":"Valid","phone":"123456","role":"ADMIN"}'::jsonb,
    jsonb_build_object('name','Valid','phone','','actor_user_id',outsider),
    jsonb_build_object('name',repeat('x',101),'phone',''),
    jsonb_build_object('name',E'Bad\nName','phone','')
  ] loop
    perform pg_temp.expect_account_denied(format('select update_own_account_details(%L,%L)',actor,command),'INVALID_ACCOUNT_DETAILS');
  end loop;
  perform pg_temp.expect_account_denied(format('select update_own_account_details(%L,null)',actor),'INVALID_ACCOUNT_DETAILS');
  perform pg_temp.expect_account_denied(format('select update_own_account_details(%L,%L)',staff,'{"name":"Forbidden","phone":""}'),'FORBIDDEN');
  perform pg_temp.expect_account_denied(format('select update_own_account_details(%L,%L)',gen_random_uuid(),'{}'),'FORBIDDEN');
  perform pg_temp.expect_account_denied('select update_own_account_details(null,''{}'')','FORBIDDEN');
  update profiles set active=false where id=actor;
  perform pg_temp.expect_account_denied(format('select update_own_account_details(%L,%L)',actor,'{"name":"Forbidden","phone":""}'),'FORBIDDEN');
  update profiles set active=true where id=actor;
  if (select count(*) from audit_logs where action='ACCOUNT_DETAILS_UPDATED' and actor_user_id=actor)<>count_before then raise exception 'DENIAL_AUDITED_AS_SUCCESS';end if;
  if exists(select 1 from audit_logs where action='ACCOUNT_DETAILS_UPDATED' and actor_user_id=actor and details<>'{}') then raise exception 'AUDIT_CONTACT_LEAK';end if;
  perform update_own_account_details(owner_id,'{"name":"Edited Owner","phone":""}');
  perform update_own_account_details(admin_id,'{"name":"Edited Admin","phone":""}');
  foreach role_name in array array['anon','authenticated'] loop
    if has_function_privilege(role_name,'public.update_own_account_details(uuid,jsonb)','EXECUTE') then raise exception 'BROWSER_RPC_ALLOWED';end if;
    if has_table_privilege(role_name,'public.profiles','UPDATE') then raise exception 'BROWSER_PROFILE_UPDATE_ALLOWED';end if;
  end loop;
  if not has_function_privilege('service_role','public.update_own_account_details(uuid,jsonb)','EXECUTE') then raise exception 'SERVER_RPC_DENIED';end if;
end $test$;
rollback;
