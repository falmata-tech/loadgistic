-- Isolated local fixtures only; no identity or operational change survives.
begin;
do $test$
declare owner_id uuid;org uuid;outsider uuid;recipient uuid:=gen_random_uuid();wrong_user uuid:=gen_random_uuid();
  invite_id uuid;other_invite uuid;vehicle_id uuid;row jsonb;before_number text;email_value text;private_phone text;
begin
  select id into strict owner_id from profiles where email='transporter@loadgistic.local';
  select organization_id into strict org from organization_members where user_id=owner_id and membership_role='OWNER';
  select id into strict outsider from profiles where email='driver@loadgistic.local';
  email_value:='fleet-test-'||recipient||'@loadgistic.local';
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
    values(recipient,email_value,now(),'{}','{}'),(wrong_user,'wrong-'||recipient||'@loadgistic.local',now(),'{}','{}');
  if not managed_provider_signup_eligible(recipient) then raise exception 'BOOTSTRAP_INELIGIBLE';end if;
  begin perform fleet_invite_driver(outsider,jsonb_build_object('email',email_value,'name','Test Driver','phone','+251900000001'));
    raise exception 'NONOWNER_INVITED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  invite_id:=fleet_invite_driver(owner_id,jsonb_build_object('email',upper(email_value),'name','Test Driver','phone','+251900000001'));
  if invite_id<>fleet_invite_driver(owner_id,jsonb_build_object('email',email_value,'name','Test Driver','phone','+251900000001')) then raise exception 'DUPLICATE_INVITE';end if;
  if jsonb_array_length(fleet_identity_invitations(wrong_user))<>0 then raise exception 'RECIPIENT_LEAK';end if;
  begin perform fleet_accept_invitation(wrong_user,invite_id);raise exception 'WRONG_RECIPIENT_ACCEPTED';
    exception when raise_exception then if sqlerrm<>'INVITATION_NOT_AVAILABLE' then raise;end if;end;
  update fleet_driver_invitations set expires_at=now()-interval '1 minute' where id=invite_id;
  begin perform fleet_accept_invitation(recipient,invite_id);raise exception 'EXPIRED_ACCEPTED';
    exception when raise_exception then if sqlerrm<>'INVITATION_NOT_AVAILABLE' then raise;end if;end;
  update fleet_driver_invitations set expires_at=now()+interval '7 days' where id=invite_id;
  update auth.users set email_confirmed_at=null where id=recipient;
  begin perform fleet_accept_invitation(recipient,invite_id);raise exception 'UNVERIFIED_EMAIL_ACCEPTED';
    exception when raise_exception then if sqlerrm<>'INVITATION_NOT_AVAILABLE' then raise;end if;end;
  update auth.users set email_confirmed_at=now() where id=recipient;
  update profiles set active=false where id=owner_id;
  begin perform fleet_accept_invitation(recipient,invite_id);raise exception 'SUSPENDED_INVITER_ACCEPTED';
    exception when raise_exception then if sqlerrm<>'INVITATION_NOT_AVAILABLE' then raise;end if;end;
  update profiles set active=true where id=owner_id;
  perform fleet_accept_invitation(recipient,invite_id);
  perform fleet_accept_invitation(recipient,invite_id); -- safe retry
  if not exists(select 1 from drivers d join organization_members m on m.user_id=d.user_id and m.organization_id=d.organization_id
    where d.user_id=recipient and d.active and d.organization_id=org and m.membership_role='DRIVER') then raise exception 'DRIVER_MEMBERSHIP_MISSING';end if;
  if (select can_manage_capacity or can_manage_tracking from driver_permissions where user_id=recipient) then raise exception 'DEFAULT_PERMISSIONS_TOO_BROAD';end if;
  row:=create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Test","plate":"TEST-123","cargo_configuration":"Mini Box Truck"}');
  vehicle_id:=(row->>'id')::uuid;before_number:=row->>'platform_number';
  perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',recipient,'vehicle_id',vehicle_id,'can_manage_capacity',true,'can_manage_tracking',true));
  if capacity_active_driver_id(vehicle_id) is distinct from recipient then raise exception 'DRIVER_NOT_PUBLISHABLE';end if;
  delete from organization_members where user_id=recipient and organization_id=org;
  if exists(select 1 from fleet_driver_page(owner_id,0,50) where payload->>'id'=recipient::text) then raise exception 'STALE_MEMBER_LISTED';end if;
  begin perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',recipient,'vehicle_id',vehicle_id));raise exception 'STALE_MEMBER_ASSIGNED';
    exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
  insert into organization_members(user_id,organization_id,membership_role) values(recipient,org,'DRIVER');
  -- FEAT-IAM-001 / migration 086 keeps the private account phone separate.
  select phone into strict private_phone from profiles where id=recipient;
  perform fleet_update_driver_contact(owner_id,jsonb_build_object('driver_user_id',recipient,'name','Updated Driver','phone','+251900000002'));
  if not exists(select 1 from profiles p join drivers d on d.user_id=p.id where p.id=recipient
    and p.full_name='Updated Driver' and d.name=p.full_name and d.phone='+251900000002'
    and p.phone is not distinct from private_phone) then raise exception 'CONTACT_NOT_UPDATED';end if;
  begin perform fleet_update_driver_contact(outsider,jsonb_build_object('driver_user_id',recipient,'name','Wrong','phone','+251900000002'));raise exception 'CROSS_OWNER_EDIT';
    exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  perform update_provider_vehicle_details(owner_id,jsonb_build_object('vehicle_id',vehicle_id,'make','Fuso','model','Canter','plate','TEST-456','cargo_configuration','Light Box Truck'));
  if not exists(select 1 from vehicles where id=vehicle_id and platform_number=before_number and model='Canter' and cargo_configuration='Light Box Truck') then raise exception 'VEHICLE_NOT_UPDATED';end if;
  if capacity_active_driver_id(vehicle_id) is distinct from recipient then raise exception 'VEHICLE_EDIT_LOST_DRIVER';end if;
  begin perform update_provider_vehicle_details(recipient,jsonb_build_object('vehicle_id',vehicle_id));raise exception 'DRIVER_EDITED_TRUCK';
    exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  begin perform update_provider_vehicle_details(outsider,jsonb_build_object('vehicle_id',vehicle_id));raise exception 'CROSS_OWNER_TRUCK';
    exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  begin perform fleet_remove_driver(outsider,recipient);raise exception 'CROSS_OWNER_REMOVAL';
    exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  perform fleet_remove_driver(owner_id,recipient);perform fleet_remove_driver(owner_id,recipient);
  begin perform fleet_accept_invitation(recipient,invite_id);raise exception 'REMOVED_DRIVER_REPLAY_ACCEPTED';
    exception when raise_exception then if sqlerrm<>'INVITATION_NOT_AVAILABLE' then raise;end if;end;
  if capacity_active_driver_id(vehicle_id) is not null or exists(select 1 from organization_members where user_id=recipient)
    or (select active from profiles where id=recipient) then raise exception 'REMOVAL_ACCESS_RETAINED';end if;
  if not exists(select 1 from driver_vehicle_assignments where driver_user_id=recipient and not active) then raise exception 'ASSIGNMENT_HISTORY_LOST';end if;
  invite_id:=fleet_invite_driver(owner_id,jsonb_build_object('email',email_value,'name','Returning Driver','phone','+251900000001'));
  perform fleet_cancel_invitation(owner_id,invite_id);
  begin perform fleet_accept_invitation(recipient,invite_id);raise exception 'CANCELLED_ACCEPTED';
    exception when raise_exception then if sqlerrm<>'INVITATION_NOT_AVAILABLE' then raise;end if;end;
  invite_id:=fleet_invite_driver(owner_id,jsonb_build_object('email',email_value,'name','Returning Driver','phone','+251900000001'));
  perform fleet_accept_invitation(recipient,invite_id);
  if not (select active from drivers where user_id=recipient) then raise exception 'SAME_FLEET_REJOIN_FAILED';end if;
  other_invite:=fleet_invite_driver(owner_id,jsonb_build_object('email','driver@loadgistic.local','name','Independent','phone','+251900000001'));
  begin perform fleet_accept_invitation(outsider,other_invite);raise exception 'INDEPENDENT_TRANSFERRED';
    exception when raise_exception then if sqlerrm<>'DRIVER_ACCOUNT_CONFLICT' then raise;end if;end;
  if has_function_privilege('authenticated','fleet_accept_invitation(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','fleet_pending_invitations(uuid)','EXECUTE')
    or has_table_privilege('authenticated','drivers','INSERT') then raise exception 'BROWSER_BYPASS';end if;
  raise notice 'PASS: invite, duplicate, email proof, expiry, cancellation, acceptance, membership, assignment, contact, edits, removal, rejoin and authorization';
end $test$;
rollback;
