-- FEAT-FLT-001 / FEAT-IAM-001 / ADR-068. Apply transactionally.
-- Real-email identities remain unconfirmed until the normal Auth login proves them.
create function public.fleet_driver_registration_target(actor_user_id uuid,command jsonb)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare org uuid:=public.fleet_owner_organization(actor_user_id); target_id uuid;
  email_value text:=lower(trim(coalesce(command->>'email','')));
  name_value text:=trim(coalesce(command->>'name','')); phone_value text:=trim(coalesce(command->>'phone',''));
begin
  if email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(email_value)>254
    or char_length(name_value) not between 2 and 100 or char_length(phone_value) not between 7 and 32
    or phone_value !~ '^\+?[0-9 ()-]+$' then raise exception 'INVALID_DRIVER_CONTACT';end if;
  select id into target_id from auth.users where lower(trim(email))=email_value;
  if target_id is not null then
    -- Serialize with signup, offboarding and competing fleet registration.
    perform 1 from profiles where id=target_id for update;
    perform 1 from auth.users where id=target_id for update;
    if exists(select 1 from drivers d join profiles p on p.id=d.user_id
      join organization_members m on m.user_id=d.user_id and m.organization_id=d.organization_id
      where d.user_id=target_id and d.organization_id=org and d.active and p.active and p.role='DRIVER')
    then return target_id;end if;
    if not exists(select 1 from profiles p join auth.users u on u.id=p.id
      where p.id=target_id and not p.active and p.role='DRIVER'
        and u.deleted_at is null and not coalesce(u.is_anonymous,false)
        and (u.banned_until is null or u.banned_until<=now())
        and nullif(trim(coalesce(u.raw_app_meta_data->>'role','')),'') is null
        and nullif(trim(coalesce(u.raw_app_meta_data->>'provisioned_by','')),'') is null
        and not exists(select 1 from applications where user_id=p.id)
        and not exists(select 1 from provider_profiles where user_id=p.id)
        and not exists(select 1 from organization_members where user_id=p.id)
        and not exists(select 1 from drivers where user_id=p.id)
        and not exists(select 1 from driver_permissions where user_id=p.id)
        and not exists(select 1 from driver_vehicle_assignments where driver_user_id=p.id)
        and not exists(select 1 from support_agent_profiles where user_id=p.id))
    then raise exception 'DRIVER_ACCOUNT_CONFLICT';end if;
  end if;
  if (select count(*) from drivers d join auth.users u on u.id=d.user_id
      where d.organization_id=org and d.active and u.email_confirmed_at is null)>=100
    then raise exception 'INVITATION_LIMIT_REACHED';end if;
  return target_id;
end $$;

create function public.fleet_register_driver(actor_user_id uuid,target_user_id uuid,command jsonb)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare org uuid:=public.fleet_owner_organization(actor_user_id); resolved_id uuid;
  email_value text:=lower(trim(coalesce(command->>'email','')));
  name_value text:=trim(coalesce(command->>'name','')); phone_value text:=trim(coalesce(command->>'phone',''));
begin
  -- Organization first, then target profile/Auth: the same order as invitation acceptance.
  perform 1 from organizations where id=org for update;
  perform public.fleet_owner_organization(actor_user_id);
  resolved_id:=public.fleet_driver_registration_target(actor_user_id,command);
  if resolved_id is null or resolved_id is distinct from target_user_id then raise exception 'DRIVER_ACCOUNT_CONFLICT';end if;
  if not exists(select 1 from auth.users where id=target_user_id and lower(trim(email))=email_value)
    then raise exception 'DRIVER_ACCOUNT_CONFLICT';end if;
  if exists(select 1 from drivers where user_id=target_user_id and organization_id=org and active)
    then return target_user_id;end if;
  update profiles set active=true,full_name=name_value where id=target_user_id;
  -- Do not overwrite the account's private phone with a fleet callback number.
  insert into organization_members(user_id,organization_id,membership_role) values(target_user_id,org,'DRIVER');
  insert into drivers(organization_id,user_id,name,phone,active) values(org,target_user_id,name_value,phone_value,true);
  insert into driver_permissions(user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,
    can_manage_capacity,can_manage_tracking,updated_by)
    values(target_user_id,false,false,false,false,false,actor_user_id);
  update fleet_driver_invitations set cancelled_at=now(),email_lease=null
    where organization_id=org and email=email_value and accepted_at is null and cancelled_at is null;
  insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
    values(actor_user_id,org,'DRIVER_ADDED','profile',target_user_id,'{}');
  return target_user_id;
end $$;

revoke all on function public.fleet_driver_registration_target(uuid,jsonb),public.fleet_register_driver(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.fleet_driver_registration_target(uuid,jsonb),public.fleet_register_driver(uuid,uuid,jsonb) to service_role;

-- Preserve the complete existing caller-bound projection; add a verified-email
-- precondition without adding a browser-callable alternate identity endpoint.
do $migration$
declare definition text; old_fragment text:='where profile.id=auth.uid()';
begin
  definition:=pg_get_functiondef('public.current_user_projection()'::regprocedure);
  if position(old_fragment in definition)=0 then raise exception 'IDENTITY_PROJECTION_CONTRACT_NOT_FOUND';end if;
  execute replace(definition,old_fragment,old_fragment||' and exists(select 1 from auth.users identity where identity.id=profile.id and identity.email_confirmed_at is not null)');
end $migration$;
