-- FEAT-BIL-001: provider access is based on identity/workspace permissions.
-- Preserve billing rows/files/audits. No plan, trial or payment activation remains.
update public.platform_controls set access_mode='FREE',access_activated_at=null where singleton;
alter table public.platform_controls add constraint provider_billing_retired check(access_mode='FREE');
alter table public.platform_controls add column provider_billing_retired boolean not null default true check(provider_billing_retired);

create or replace function public.has_workspace_access()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(
  select 1 from public.profiles p where p.id=auth.uid() and p.active and (
   p.role::text='ADMIN' or p.role::text in ('TRANSPORTER','DRIVER') and (
    exists(select 1 from public.organization_members m where m.user_id=p.id)
    or exists(select 1 from public.provider_profiles x where x.user_id=p.id)
   )
  )
 );
$$;

-- Retain the exact role/linkage/driver-permission contracts and existing ACLs.
do $migration$
declare signature text;definition text;replacement text;pattern text;
begin
 pattern:=E'exists\\(\\s*select 1\\s*from public\\.subscriptions subscription\\s*where \\(subscription\\.organization_id=membership\\.organization_id\\s*or subscription\\.provider_profile_id=provider\\.id\\)\\s*and \\(\\s*public\\.subscription_is_usable\\(subscription\\)\\s*\\)\\s*\\)';
 foreach signature in array array[
  'public.provider_capacity_actor_scope(uuid)',
  'public.provider_tracking_actor_scope(uuid)',
  'public.provider_profile_actor_scope(uuid)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  replacement:=regexp_replace(definition,pattern,'(membership.organization_id is not null or provider.id is not null)','s');
  if replacement=definition or position('public.subscriptions' in replacement)>0 then raise exception 'BILLING_SCOPE_CONTRACT_NOT_FOUND: %',signature;end if;
  execute replacement;
 end loop;

 signature:='public.complete_provider_signup(uuid,text)';
 definition:=pg_get_functiondef(signature::regprocedure);
 replacement:=regexp_replace(definition,E'  select plan\\.id into plan_id from public\\.plans plan\\s*.*?  if plan_id is null then raise exception ''SIGNUP_PLAN_UNAVAILABLE''; end if;','', 's');
 if replacement=definition then raise exception 'SIGNUP_PLAN_LOOKUP_NOT_FOUND';end if;
 definition:=replacement;
 replacement:=regexp_replace(definition,E'    insert into public\\.subscriptions\\(.*?    \\);','', 'gs');
 if replacement=definition or position('insert into public.subscriptions' in replacement)>0 then raise exception 'SIGNUP_TRIAL_INSERT_NOT_REMOVED';end if;
 replacement:=replace(replacement,E'  plan_id uuid;\n','');
 replacement:=replace(replacement,E'  ends_at timestamptz:=started_at+interval ''7 days'';\n','');
 replacement:=replace(replacement,'''accessStatus'',''TRIAL'',''accessEndsAt'',ends_at','''accessStatus'',''FREE_ACCESS'',''accessEndsAt'',null');
 replacement:=replace(replacement,'''trialEndsAt'',ends_at','''trialEndsAt'',null');
 if position('ends_at' in replacement)>0 or position('plan_id' in replacement)>0 then raise exception 'SIGNUP_BILLING_DEPENDENCY_REMAINS';end if;
 execute replacement;

 definition:=pg_get_functiondef('public.save_managed_platform_controls(uuid,jsonb)'::regprocedure);
 replacement:=regexp_replace(definition,E'  if command->>''section''=''ACCESS'' then.*?  elsif command->>''section''=''FEATURED'' then',E'  if command->>''section''=''ACCESS'' then\n    raise exception ''BILLING_RETIRED'';\n  elsif command->>''section''=''FEATURED'' then','s');
 if replacement=definition or position('TRIAL_PAYMENT' in replacement)>0 then raise exception 'BILLING_ACTIVATION_CONTRACT_NOT_FOUND';end if;
 execute replacement;

 definition:=pg_get_functiondef('public.managed_admin_record_command(uuid,text,uuid,jsonb)'::regprocedure);
 pattern:='  if actor_role is null then raise exception ''FORBIDDEN''; end if;';
 if position(pattern in definition)=0 then raise exception 'ADMIN_BILLING_GUARD_NOT_FOUND';end if;
 replacement:=replace(definition,pattern,pattern||E'\n  if selected_type in (''SUBSCRIPTION'',''SUBSCRIPTIONS'',''PLAN'',''PLANS'',''WORKSPACE_SPONSOR'') then raise exception ''BILLING_RETIRED''; end if;');
 execute replacement;
end $migration$;

create or replace function public.submit_managed_payment_proof(actor_user_id uuid,command jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.profiles p where p.id=actor_user_id and p.active and p.role::text in ('TRANSPORTER','DRIVER')) then raise exception 'FORBIDDEN';end if;
 raise exception 'BILLING_RETIRED';
end $$;
create or replace function public.review_managed_payment_proof(actor_user_id uuid,proof_id uuid,review_status text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.managed_actor_has_permission(actor_user_id,'BILLING') then raise exception 'FORBIDDEN';end if;
 raise exception 'BILLING_RETIRED';
end $$;

-- No new function or browser grant. Historical read commands remain unchanged.
revoke all on function public.submit_managed_payment_proof(uuid,jsonb),public.review_managed_payment_proof(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.submit_managed_payment_proof(uuid,jsonb),public.review_managed_payment_proof(uuid,uuid,text) to service_role;
