-- Managed Auth creates an inactive placeholder profile before application
-- provisioning. Promote only that exact unowned placeholder to SUPPORT.

create or replace function public.create_managed_support_agent(actor_user_id uuid,agent_auth_user_id uuid,command jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare actor public.profiles%rowtype;auth_user auth.users%rowtype;name_value text:=trim(coalesce(command->>'name',''));
  email_value text:=lower(trim(coalesce(command->>'email','')));max_open integer:=coalesce(nullif(command->>'max_open_conversations','')::integer,3);
begin
  select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text='ADMIN';
  if not found then raise exception 'FORBIDDEN'; end if;
  if char_length(name_value) not between 1 and 120 or char_length(email_value) not between 3 and 254 then raise exception 'MISSING_REQUIRED_FIELDS'; end if;
  if max_open not between 1 and 20 then raise exception 'INVALID_SUPPORT_AGENT_LIMIT'; end if;
  select * into auth_user from auth.users account where account.id=agent_auth_user_id and lower(account.email)=email_value;
  if not found then raise exception 'MANAGED_IDENTITY_NOT_FOUND'; end if;
  if exists(select 1 from public.profiles profile where lower(profile.email)=email_value and profile.id<>agent_auth_user_id) then
    raise exception 'EMAIL_ALREADY_EXISTS';
  end if;
  if exists(select 1 from public.profiles profile where profile.id=agent_auth_user_id and (
    profile.active or exists(select 1 from public.organization_members member where member.user_id=profile.id)
    or exists(select 1 from public.provider_profiles provider where provider.user_id=profile.id)
    or exists(select 1 from public.drivers driver where driver.user_id=profile.id)
    or exists(select 1 from public.support_agent_profiles support where support.user_id=profile.id)
  )) then raise exception 'EMAIL_ALREADY_EXISTS'; end if;
  insert into public.profiles(id,email,phone,full_name,role,active,created_at)
  values(agent_auth_user_id,email_value,null,name_value,'SUPPORT',true,now())
  on conflict(id) do update set email=excluded.email,phone=null,full_name=excluded.full_name,role='SUPPORT',active=true;
  insert into public.support_agent_profiles(user_id,active,available,max_open_conversations,
    can_manage_customers,can_manage_operations,can_manage_trust,can_manage_billing,can_manage_support,created_at,updated_at)
  values(agent_auth_user_id,true,coalesce((command->>'can_manage_support')::boolean,true),max_open,
    coalesce((command->>'can_manage_customers')::boolean,false),coalesce((command->>'can_manage_operations')::boolean,false),
    coalesce((command->>'can_manage_trust')::boolean,false),coalesce((command->>'can_manage_billing')::boolean,false),
    coalesce((command->>'can_manage_support')::boolean,true),now(),now());
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor.id,'SUPPORT_AGENT_CREATED','support_agent',agent_auth_user_id,
    jsonb_build_object('maxOpenConversations',max_open,'permissions',jsonb_build_object(
      'customers',coalesce((command->>'can_manage_customers')::boolean,false),
      'operations',coalesce((command->>'can_manage_operations')::boolean,false),
      'trust',coalesce((command->>'can_manage_trust')::boolean,false),
      'billing',coalesce((command->>'can_manage_billing')::boolean,false),
      'support',coalesce((command->>'can_manage_support')::boolean,true))),now());
  perform public.support_assign_waiting(max_open);
  return agent_auth_user_id;
end;
$$;

revoke all on function public.create_managed_support_agent(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_managed_support_agent(uuid,uuid,jsonb) to service_role;
