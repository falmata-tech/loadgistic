-- FEAT-FLT-001 / FEAT-IAM-001: isolated fixtures, all changes rolled back.
begin;
do $test$
declare owner_id uuid; outsider uuid; recipient uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid();
  email_value text; input jsonb; vehicle_id uuid; private_phone text; candidate uuid; other_org uuid:=gen_random_uuid();
begin
  select id into strict owner_id from profiles where email='transporter@loadgistic.local';
  select id into strict outsider from profiles where email='driver@loadgistic.local';
  email_value:='unverified-'||recipient||'@loadgistic.local';
  input:=jsonb_build_object('email',email_value,'name','Unverified Driver','phone','+251900000001');
  if fleet_driver_registration_target(owner_id,input) is not null then raise exception 'UNEXPECTED_IDENTITY';end if;
  begin perform fleet_driver_registration_target(outsider,input);raise exception 'NONOWNER_ALLOWED';
    exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
    values(recipient,email_value,'{}','{}'),(other_id,'other-'||email_value,'{}','{}');
  select phone into private_phone from profiles where id=recipient;
  begin perform fleet_register_driver(owner_id,other_id,input);raise exception 'WRONG_IDENTITY_ADOPTED';
    exception when raise_exception then if sqlerrm<>'DRIVER_ACCOUNT_CONFLICT' then raise;end if;end;
  perform fleet_invite_driver(owner_id,input);
  if fleet_register_driver(owner_id,recipient,input)<>recipient then raise exception 'WRONG_REGISTERED_ID';end if;
  perform fleet_register_driver(owner_id,recipient,input||'{"name":"Do not overwrite","phone":"+251900000099"}'::jsonb);
  if not exists(select 1 from drivers where user_id=recipient and name='Unverified Driver' and phone='+251900000001') then raise exception 'RETRY_OVERWROTE_CONTACT';end if;
  if (select phone from profiles where id=recipient) is distinct from private_phone then raise exception 'PRIVATE_PHONE_CHANGED';end if;
  if (select email_confirmed_at from auth.users where id=recipient) is not null then raise exception 'EMAIL_AUTOCONFIRMED';end if;
  if exists(select 1 from fleet_driver_invitations where email=email_value and cancelled_at is null) then raise exception 'STALE_INVITE';end if;
  if (select can_manage_capacity or can_manage_tracking from driver_permissions where user_id=recipient) then raise exception 'BROAD_DEFAULTS';end if;
  perform set_config('request.jwt.claim.sub',recipient::text,true);
  if current_user_projection() is not null then raise exception 'UNVERIFIED_WORKSPACE_ACCESS';end if;
  vehicle_id:=(create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Test","plate":"UNVERIFIED-123","cargo_configuration":"Mini Box Truck"}')->>'id')::uuid;
  perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',recipient,'vehicle_id',vehicle_id,'can_manage_capacity',true,'can_manage_tracking',true));
  if capacity_active_driver_id(vehicle_id) is distinct from recipient then raise exception 'UNVERIFIED_ASSIGNMENT_BLOCKED';end if;
  update auth.users set email_confirmed_at=now() where id=recipient;
  if current_user_projection()->>'id' is distinct from recipient::text then raise exception 'VERIFIED_WORKSPACE_DENIED';end if;
  if capacity_active_driver_id(vehicle_id) is distinct from recipient then raise exception 'LOGIN_LOST_ASSIGNMENT';end if;
  begin
    insert into organizations(id,name,handle,type)
      select other_org,'Other test fleet','test-'||other_org,o.type from organizations o
      join organization_members m on m.organization_id=o.id where m.user_id=owner_id and m.membership_role='OWNER';
    update drivers set organization_id=other_org where user_id=recipient;
    perform fleet_driver_registration_target(owner_id,input);raise exception 'OTHER_FLEET_ADOPTED';
    exception when raise_exception then if sqlerrm<>'DRIVER_ACCOUNT_CONFLICT' then raise;end if;
  end; -- nested rollback restores the original fleet
  begin
    update profiles set active=false where id=recipient;
    perform fleet_driver_registration_target(owner_id,input);raise exception 'SUSPENDED_DRIVER_REACTIVATED';
    exception when raise_exception then if sqlerrm<>'DRIVER_ACCOUNT_CONFLICT' then raise;end if;
  end;
  -- Provider/self-managed identities cannot be captured by a fleet.
  foreach candidate in array array[owner_id,outsider] loop
    begin perform fleet_driver_registration_target(owner_id,input||jsonb_build_object('email',(select email from profiles where id=candidate)));raise exception 'EXISTING_ACCOUNT_ADOPTED';
      exception when raise_exception then if sqlerrm<>'DRIVER_ACCOUNT_CONFLICT' then raise;end if;end;
  end loop;
  update auth.users set banned_until=now()+interval '1 day' where id=other_id;
  begin perform fleet_driver_registration_target(owner_id,input||jsonb_build_object('email','other-'||email_value));raise exception 'BANNED_ADOPTED';
    exception when raise_exception then if sqlerrm<>'DRIVER_ACCOUNT_CONFLICT' then raise;end if;end;
  update auth.users set banned_until=null,raw_app_meta_data='{"provisioned_by":"platform"}' where id=other_id;
  begin perform fleet_driver_registration_target(owner_id,input||jsonb_build_object('email','other-'||email_value));raise exception 'RESERVED_IDENTITY_ADOPTED';
    exception when raise_exception then if sqlerrm<>'DRIVER_ACCOUNT_CONFLICT' then raise;end if;end;
  perform fleet_remove_driver(owner_id,recipient);
  if capacity_active_driver_id(vehicle_id) is not null or (current_user_projection()->>'active')::boolean then raise exception 'OFFBOARDING_ACCESS_RETAINED';end if;
  if not exists(select 1 from driver_vehicle_assignments where driver_user_id=recipient and not active) then raise exception 'HISTORY_LOST';end if;
  if has_function_privilege('authenticated','fleet_register_driver(uuid,uuid,jsonb)','EXECUTE')
    or has_function_privilege('anon','fleet_driver_registration_target(uuid,jsonb)','EXECUTE') then raise exception 'BROWSER_BYPASS';end if;
  raise notice 'PASS: immediate assignment, unchanged confirmation, login gate, same identity, safe retry, private phone, conflicts, revocation and browser denial';
end $test$;
rollback;
