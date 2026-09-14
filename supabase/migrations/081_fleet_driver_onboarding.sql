-- FEAT-FLT-001 / FEAT-IAM-001: invitation consent and complete fleet lifecycle.
alter table public.drivers add column offboarded_at timestamptz;

create table public.fleet_driver_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  email text not null check(email=lower(trim(email)) and char_length(email) between 3 and 254),
  driver_name text not null check(char_length(driver_name) between 2 and 100),
  phone text not null check(char_length(phone) between 7 and 32),
  invited_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  email_attempted_at timestamptz,
  email_sent_at timestamptz,
  email_lease uuid,
  check(not(accepted_at is not null and cancelled_at is not null))
);
create unique index fleet_driver_invitation_pending_idx on public.fleet_driver_invitations(organization_id,email)
  where accepted_at is null and cancelled_at is null;
create index fleet_driver_invitation_recipient_idx on public.fleet_driver_invitations(email,expires_at)
  where accepted_at is null and cancelled_at is null;
alter table public.fleet_driver_invitations enable row level security;
revoke all on public.fleet_driver_invitations from anon,authenticated;
grant all on public.fleet_driver_invitations to service_role;

-- All owner mutations use this scope and serialize against the organization.
create function public.fleet_owner_organization(actor_user_id uuid) returns uuid
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor record;
begin
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found or actor.actor_role<>'TRANSPORTER' or actor.organization_id is null
    or not exists(select 1 from organization_members where user_id=actor_user_id
      and organization_id=actor.organization_id and membership_role='OWNER') then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;
  return actor.organization_id;
end $$;

create function public.fleet_invitation_joinable(actor_user_id uuid,target_org uuid) returns boolean
language sql stable security definer set search_path=public,auth,pg_temp as $$
  select public.managed_provider_signup_eligible(actor_user_id) or exists(
    select 1 from profiles p join auth.users u on u.id=p.id
    join drivers d on d.user_id=p.id and d.organization_id=target_org
    where p.id=actor_user_id and p.role='DRIVER' and not p.active and not d.active and d.offboarded_at is not null
      and u.email_confirmed_at is not null
      and nullif(trim(coalesce(u.raw_app_meta_data->>'role','')),'') is null
      and nullif(trim(coalesce(u.raw_app_meta_data->>'provisioned_by','')),'') is null
      and not exists(select 1 from organization_members where user_id=p.id)
      and not exists(select 1 from provider_profiles where user_id=p.id)
      and not exists(select 1 from support_agent_profiles where user_id=p.id)
      and not exists(select 1 from applications where user_id=p.id)
  )
$$;

create function public.fleet_invite_driver(actor_user_id uuid,command jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid:=public.fleet_owner_organization(actor_user_id); invite_id uuid;
  email_value text:=lower(trim(coalesce(command->>'email','')));
  name_value text:=trim(coalesce(command->>'name','')); phone_value text:=trim(coalesce(command->>'phone',''));
begin
  if email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(email_value)>254
    or char_length(name_value) not between 2 and 100 or char_length(phone_value) not between 7 and 32
    or phone_value !~ '^\+?[0-9 ()-]+$' then raise exception 'INVALID_DRIVER_CONTACT'; end if;
  perform 1 from organizations where id=org for update;
  if exists(select 1 from drivers d join profiles p on p.id=d.user_id
    where d.organization_id=org and d.active and lower(p.email)=email_value) then raise exception 'DRIVER_ALREADY_IN_FLEET'; end if;
  update fleet_driver_invitations set cancelled_at=now() where organization_id=org and email=email_value
    and accepted_at is null and cancelled_at is null and expires_at<=now();
  select id into invite_id from fleet_driver_invitations where organization_id=org and email=email_value
    and accepted_at is null and cancelled_at is null;
  if invite_id is not null then return invite_id; end if;
  if (select count(*) from fleet_driver_invitations where organization_id=org and accepted_at is null
    and cancelled_at is null and expires_at>now())>=100 then raise exception 'INVITATION_LIMIT_REACHED'; end if;
  insert into fleet_driver_invitations(organization_id,email,driver_name,phone,invited_by)
    values(org,email_value,name_value,phone_value,actor_user_id) returning id into invite_id;
  insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
    values(actor_user_id,org,'DRIVER_INVITED','driver_invitation',invite_id,'{}');
  return invite_id;
end $$;

create function public.fleet_pending_invitations(actor_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare org uuid:=public.fleet_owner_organization(actor_user_id); result jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(row) order by row.created_at desc),'[]') into result from (
    select id,email,driver_name,phone,created_at,expires_at,email_sent_at from fleet_driver_invitations
    where organization_id=org and accepted_at is null and cancelled_at is null and expires_at>now()
    order by created_at desc,id limit 100
  ) row;
  return result;
end $$;

create function public.fleet_identity_invitations(actor_user_id uuid) returns jsonb
language sql stable security definer set search_path=public,auth,pg_temp as $$
  select coalesce(jsonb_agg(to_jsonb(row)),'[]') from (
    select i.id,o.name as organization_name,i.driver_name,i.expires_at,
      public.fleet_invitation_joinable(actor_user_id,i.organization_id) as can_accept
    from fleet_driver_invitations i join organizations o on o.id=i.organization_id
    join auth.users u on lower(trim(u.email))=i.email and u.email_confirmed_at is not null
    where u.id=actor_user_id and i.accepted_at is null and i.cancelled_at is null and i.expires_at>now()
    order by i.created_at desc,i.id limit 50
  ) row
$$;

create function public.fleet_accept_invitation(actor_user_id uuid,invitation_id uuid) returns uuid
language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare invitation fleet_driver_invitations%rowtype; org uuid; confirmed_email text;
begin
  select organization_id into org from fleet_driver_invitations where id=invitation_id;
  perform 1 from organizations where id=org for update;
  perform 1 from profiles where id=actor_user_id for update;
  select lower(trim(email)) into confirmed_email from auth.users
    where id=actor_user_id and email_confirmed_at is not null for update;
  select * into invitation from fleet_driver_invitations where id=invitation_id for update;
  if invitation.id is null or confirmed_email is null or invitation.email<>confirmed_email
    or invitation.cancelled_at is not null then raise exception 'INVITATION_NOT_AVAILABLE'; end if;
  if invitation.accepted_by=actor_user_id and invitation.accepted_at is not null then
    if exists(select 1 from drivers d join organization_members m on m.user_id=d.user_id and m.organization_id=d.organization_id
      join profiles p on p.id=d.user_id and p.active
      where d.user_id=actor_user_id and d.organization_id=org and d.active) then return org; end if;
    raise exception 'INVITATION_NOT_AVAILABLE';
  end if;
  if invitation.accepted_at is not null or invitation.expires_at<=now() then raise exception 'INVITATION_NOT_AVAILABLE'; end if;
  if not exists(select 1 from organization_members m join profiles p on p.id=m.user_id and p.active and p.role='TRANSPORTER'
    where m.user_id=invitation.invited_by and m.organization_id=org and m.membership_role='OWNER') then
    raise exception 'INVITATION_NOT_AVAILABLE';
  end if;
  if not public.fleet_invitation_joinable(actor_user_id,org) then raise exception 'DRIVER_ACCOUNT_CONFLICT'; end if;
  update profiles set active=true,full_name=invitation.driver_name,phone=invitation.phone where id=actor_user_id;
  insert into organization_members(user_id,organization_id,membership_role) values(actor_user_id,org,'DRIVER');
  insert into drivers(organization_id,user_id,name,phone,active) values(org,actor_user_id,invitation.driver_name,invitation.phone,true)
    on conflict(user_id) do update set name=excluded.name,phone=excluded.phone,active=true,offboarded_at=null;
  insert into driver_permissions(user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,
    can_manage_capacity,can_manage_tracking,updated_by)
    values(actor_user_id,false,false,false,false,false,invitation.invited_by)
    on conflict(user_id) do update set can_browse_load_board=false,can_contact_businesses=false,can_negotiate_loads=false,
      can_manage_capacity=false,can_manage_tracking=false,updated_by=excluded.updated_by,updated_at=now();
  update fleet_driver_invitations set accepted_at=now(),accepted_by=actor_user_id where id=invitation.id;
  insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
    values(actor_user_id,org,'DRIVER_INVITATION_ACCEPTED','driver_invitation',invitation.id,'{}');
  return org;
end $$;

create function public.fleet_cancel_invitation(actor_user_id uuid,invitation_id uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid:=public.fleet_owner_organization(actor_user_id);
begin
  perform 1 from organizations where id=org for update;
  update fleet_driver_invitations set cancelled_at=now(),email_lease=null
    where id=invitation_id and organization_id=org and accepted_at is null and cancelled_at is null;
  if not found then raise exception 'INVITATION_NOT_AVAILABLE'; end if;
  insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
    values(actor_user_id,org,'DRIVER_INVITATION_CANCELLED','driver_invitation',invitation_id,'{}');
  return true;
end $$;

-- Explicit retry, no unbounded background work. A delivery claim prevents double clicks.
create function public.fleet_claim_invitation_email(actor_user_id uuid,invitation_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid:=public.fleet_owner_organization(actor_user_id); invitation fleet_driver_invitations%rowtype;
begin
  update fleet_driver_invitations set email_lease=gen_random_uuid(),email_attempted_at=now()
    where id=invitation_id and organization_id=org and accepted_at is null and cancelled_at is null and expires_at>now()
      and (email_attempted_at is null or email_attempted_at<now()-interval '1 minute') returning * into invitation;
  if not found then return null; end if;
  return jsonb_build_object('id',invitation.id,'email',invitation.email,'lease',invitation.email_lease,
    'organization_name',(select name from organizations where id=org));
end $$;

create function public.fleet_record_invitation_email(invitation_id uuid,lease_id uuid,sent boolean) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update fleet_driver_invitations set email_sent_at=case when sent then now() else email_sent_at end,email_lease=null
    where id=invitation_id and email_lease=lease_id and cancelled_at is null and accepted_at is null;
  return found;
end $$;

create function public.fleet_update_driver_contact(actor_user_id uuid,command jsonb) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid:=public.fleet_owner_organization(actor_user_id); driver_id uuid:=(command->>'driver_user_id')::uuid;
  name_value text:=trim(coalesce(command->>'name','')); phone_value text:=trim(coalesce(command->>'phone',''));
begin
  perform 1 from organizations where id=org for update;
  if char_length(name_value) not between 2 and 100 or char_length(phone_value) not between 7 and 32
    or phone_value !~ '^\+?[0-9 ()-]+$' then raise exception 'INVALID_DRIVER_CONTACT'; end if;
  if not exists(select 1 from drivers d join organization_members m on m.user_id=d.user_id and m.organization_id=d.organization_id
    join profiles p on p.id=d.user_id and p.active and p.role='DRIVER'
    where d.user_id=driver_id and d.organization_id=org and d.active) then raise exception 'NOT_FOUND'; end if;
  update drivers set name=name_value,phone=phone_value where user_id=driver_id;
  update profiles set full_name=name_value,phone=phone_value where id=driver_id;
  insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
    values(actor_user_id,org,'DRIVER_CONTACT_UPDATED','driver',driver_id,'{}');
  return true;
end $$;

create function public.fleet_remove_driver(actor_user_id uuid,driver_user_id uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid:=public.fleet_owner_organization(actor_user_id); driver_row drivers%rowtype;
begin
  perform 1 from organizations where id=org for update;
  select * into driver_row from drivers where user_id=driver_user_id and organization_id=org for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if driver_row.offboarded_at is not null and not driver_row.active then return true; end if;
  if exists(select 1 from organization_members where user_id=driver_user_id
    and (organization_id<>org or membership_role='OWNER'))
    or exists(select 1 from provider_profiles where user_id=driver_user_id) then raise exception 'DRIVER_ACCOUNT_CONFLICT'; end if;
  update driver_vehicle_assignments set active=false where driver_vehicle_assignments.driver_user_id=fleet_remove_driver.driver_user_id;
  update driver_permissions set can_manage_capacity=false,can_manage_tracking=false,
    can_browse_load_board=false,can_contact_businesses=false,can_negotiate_loads=false,updated_by=actor_user_id,updated_at=now()
    where user_id=driver_user_id;
  delete from organization_members where user_id=driver_user_id and organization_id=org and membership_role<>'OWNER';
  update drivers set active=false,offboarded_at=now() where id=driver_row.id;
  update profiles set active=false where id=driver_user_id and role='DRIVER';
  insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
    values(actor_user_id,org,'DRIVER_REMOVED_FROM_FLEET','driver',driver_user_id,'{}');
  return true;
end $$;

create function public.update_provider_vehicle_details(actor_user_id uuid,command jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor record; vehicle vehicles%rowtype;
  make_value text:=trim(coalesce(command->>'make','')); model_value text:=trim(coalesce(command->>'model',''));
  plate_value text:=trim(coalesce(command->>'plate','')); config text:=trim(coalesce(command->>'cargo_configuration',''));
begin
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found or actor.is_company_driver or (actor.actor_role='DRIVER' and actor.provider_profile_id is null) then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;
  if actor.actor_role='TRANSPORTER' then perform public.fleet_owner_organization(actor_user_id); end if;
  select * into vehicle from vehicles where id=(command->>'vehicle_id')::uuid and active for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if actor.actor_role='TRANSPORTER' and vehicle.organization_id is distinct from actor.organization_id
    or actor.actor_role='DRIVER' and vehicle.provider_profile_id is distinct from actor.provider_profile_id then raise exception 'FORBIDDEN'; end if;
  if char_length(make_value) not between 2 and 60 then raise exception 'INVALID_VEHICLE_MAKE'; end if;
  if char_length(model_value) not between 1 and 60 then raise exception 'INVALID_VEHICLE_MODEL'; end if;
  if char_length(plate_value) not between 2 and 32 then raise exception 'INVALID_VEHICLE_PLATE'; end if;
  if vehicle.trailer_interchangeable then
    -- Trailer attachment has its own command; concurrent contact edits must not undo it.
    config:=vehicle.cargo_configuration;
  elsif config<>all(array['Courier car','Cargo van','Pickup truck','Pickup stake body',
    'Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck','Light Stake Body Truck','Light Box Truck',
    'Medium Stake Body Truck','Medium Box Truck','Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer']) then
    raise exception 'INVALID_VEHICLE_CONFIGURATION';
  end if;
  update vehicles set make=make_value,model=model_value,plate=plate_value,label=concat_ws(' ',make_value,model_value),
    cargo_configuration=config,category=case when vehicle.trailer_interchangeable then 'Tractor' else config end where id=vehicle.id;
  insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
    values(actor_user_id,actor.organization_id,'PROVIDER_VEHICLE_DETAILS_UPDATED','vehicle',vehicle.id,'{}');
  return vehicle.id;
end $$;

-- Server routes establish the actor; browser clients cannot supply arbitrary IDs.
do $$ declare signature text; begin
  foreach signature in array array[
    'fleet_owner_organization(uuid)','fleet_invitation_joinable(uuid,uuid)',
    'fleet_invite_driver(uuid,jsonb)','fleet_pending_invitations(uuid)','fleet_identity_invitations(uuid)',
    'fleet_accept_invitation(uuid,uuid)','fleet_cancel_invitation(uuid,uuid)',
    'fleet_claim_invitation_email(uuid,uuid)','fleet_record_invitation_email(uuid,uuid,boolean)',
    'fleet_update_driver_contact(uuid,jsonb)','fleet_remove_driver(uuid,uuid)','update_provider_vehicle_details(uuid,jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public,anon,authenticated',signature);
    execute format('grant execute on function public.%s to service_role',signature);
  end loop;
end $$;

-- Direct browser writes must not bypass verified invitation acceptance or revocation.
revoke insert,update,delete on public.drivers,public.driver_permissions,public.driver_vehicle_assignments,
  public.organization_members from anon,authenticated;
