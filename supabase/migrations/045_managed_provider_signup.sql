-- BASE-BE-001 / FEAT-APP-001 / FEAT-IAM-001
-- Short-lived signup intent and one transactional provider-workspace command.
-- Browser roles never receive direct access to the intent or provisioning RPCs.

create table if not exists public.provider_signup_intents (
  id uuid primary key default gen_random_uuid(),
  token_digest text not null unique check (token_digest ~ '^[a-f0-9]{64}$'),
  full_name text not null,
  business_name text not null,
  phone text not null,
  application_type text not null check (application_type in (
    'TRANSPORT_COMPANY','OWNER_OPERATOR','SELF_MANAGED_DRIVER'
  )),
  notes text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists provider_signup_intents_expiry_idx
  on public.provider_signup_intents(expires_at,consumed_at,created_at);

alter table public.provider_signup_intents enable row level security;
revoke all on table public.provider_signup_intents from public,anon,authenticated;
grant select,insert,update,delete on table public.provider_signup_intents to service_role;

create or replace function public.bootstrap_loadgistic_auth_profile()
returns trigger
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  display_name text;
begin
  if nullif(trim(coalesce(new.email,'')),'') is null then return new; end if;
  display_name:=left(trim(coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email,'@',1),
    'Transport provider'
  )),120);
  if display_name='' then display_name:='Transport provider'; end if;
  insert into public.profiles(id,email,phone,full_name,role,active,created_at)
  values(new.id,lower(trim(new.email)),null,display_name,'DRIVER',false,clock_timestamp())
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists bootstrap_loadgistic_auth_profile_trigger on auth.users;
create trigger bootstrap_loadgistic_auth_profile_trigger
after insert on auth.users
for each row execute function public.bootstrap_loadgistic_auth_profile();

create or replace function public.prepare_provider_signup_intent(
  requested_token_digest text,
  requested_full_name text,
  requested_business_name text,
  requested_phone text,
  requested_application_type text,
  requested_notes text,
  requested_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  intent_id uuid:=gen_random_uuid();
  clean_name text:=trim(coalesce(requested_full_name,''));
  clean_business text:=trim(coalesce(requested_business_name,''));
  clean_phone text:=trim(coalesce(requested_phone,''));
  clean_type text:=upper(trim(coalesce(requested_application_type,'')));
  clean_notes text:=left(trim(coalesce(requested_notes,'')),1000);
begin
  if requested_token_digest !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_SIGNUP_INTENT'; end if;
  if length(clean_name)<2 or length(clean_name)>120 then raise exception 'INVALID_SIGNUP_NAME'; end if;
  if length(clean_business)<2 or length(clean_business)>140 then raise exception 'INVALID_SIGNUP_BUSINESS'; end if;
  if length(clean_phone)<7 or length(clean_phone)>30 or clean_phone !~ '^[0-9+() .-]+$' then
    raise exception 'INVALID_SIGNUP_PHONE';
  end if;
  if clean_type not in ('TRANSPORT_COMPANY','OWNER_OPERATOR','SELF_MANAGED_DRIVER') then
    raise exception 'INVALID_APPLICATION_TYPE';
  end if;
  if requested_expires_at<=now() or requested_expires_at>now()+interval '15 minutes 5 seconds' then
    raise exception 'INVALID_SIGNUP_EXPIRY';
  end if;

  delete from public.provider_signup_intents
  where id in (
    select expired.id from public.provider_signup_intents expired
    where expired.expires_at<now()-interval '7 days'
    order by expired.expires_at,expired.id limit 100
  );

  insert into public.provider_signup_intents(
    id,token_digest,full_name,business_name,phone,application_type,notes,expires_at
  ) values(
    intent_id,requested_token_digest,clean_name,clean_business,clean_phone,clean_type,
    nullif(clean_notes,''),requested_expires_at
  );
  return intent_id;
end;
$$;

create or replace function public.complete_provider_signup(
  actor_user_id uuid,
  requested_token_digest text
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  intent public.provider_signup_intents%rowtype;
  auth_user auth.users%rowtype;
  actor public.profiles%rowtype;
  plan_id uuid;
  application_id uuid:=gen_random_uuid();
  organization_id uuid;
  provider_profile_id uuid;
  owner_handle text;
  handle_base text;
  started_at timestamptz:=clock_timestamp();
  ends_at timestamptz:=started_at+interval '7 days';
  target_role public.user_role;
begin
  if requested_token_digest !~ '^[a-f0-9]{64}$' then raise exception 'SIGNUP_NOT_AVAILABLE'; end if;
  select candidate.* into intent
  from public.provider_signup_intents candidate
  where candidate.token_digest=requested_token_digest
    and candidate.consumed_at is null and candidate.expires_at>now()
  for update;
  if not found then raise exception 'SIGNUP_NOT_AVAILABLE'; end if;

  select candidate.* into auth_user from auth.users candidate
  where candidate.id=actor_user_id and candidate.email_confirmed_at is not null;
  if not found or nullif(trim(coalesce(auth_user.email,'')),'') is null then
    raise exception 'SIGNUP_IDENTITY_REQUIRED';
  end if;

  insert into public.profiles(id,email,phone,full_name,role,active,created_at)
  values(actor_user_id,lower(trim(auth_user.email)),null,
    left(coalesce(nullif(trim(auth_user.raw_user_meta_data->>'full_name'),''),intent.full_name),120),
    'DRIVER',false,started_at)
  on conflict(id) do nothing;

  select candidate.* into actor from public.profiles candidate
  where candidate.id=actor_user_id for update;
  if not found or actor.active
    or exists(select 1 from public.applications application where application.user_id=actor_user_id)
    or exists(select 1 from public.provider_profiles provider where provider.user_id=actor_user_id)
    or exists(select 1 from public.organization_members membership where membership.user_id=actor_user_id)
  then raise exception 'SIGNUP_ALREADY_PROVISIONED'; end if;

  target_role:=case when intent.application_type='TRANSPORT_COMPANY'
    then 'TRANSPORTER'::public.user_role else 'DRIVER'::public.user_role end;
  select plan.id into plan_id from public.plans plan
  where plan.active and plan.audience=case when target_role='TRANSPORTER' then 'TRANSPORTER' else 'DRIVER' end
  order by plan.code,plan.id limit 1;
  if plan_id is null then raise exception 'SIGNUP_PLAN_UNAVAILABLE'; end if;

  handle_base:=left(trim(both '-' from regexp_replace(lower(intent.business_name),'[^a-z0-9]+','-','g')),36);
  if handle_base='' then handle_base:='transporter'; end if;
  loop
    owner_handle:=handle_base||'-'||left(replace(gen_random_uuid()::text,'-',''),8);
    exit when not exists(select 1 from public.organizations organization where organization.handle=owner_handle)
      and not exists(select 1 from public.provider_profiles provider where provider.handle=owner_handle);
  end loop;

  if intent.application_type='TRANSPORT_COMPANY' then
    organization_id:=gen_random_uuid();
    insert into public.organizations(
      id,name,handle,type,verified,description,phone,email,public_visibility,created_at
    ) values(
      organization_id,intent.business_name,owner_handle,'TRANSPORT_COMPANY',false,
      'Complete your transporter profile and submit current documents before publishing.',
      null,null,'PUBLIC',started_at
    );
    insert into public.organization_members(id,user_id,organization_id,membership_role)
    values(gen_random_uuid(),actor_user_id,organization_id,'OWNER');
    insert into public.company_pages(
      id,organization_id,provider_profile_id,headline,about,published,updated_at
    ) values(
      gen_random_uuid(),organization_id,null,'Transport services',
      'Complete this transporter profile before publishing.',false,started_at
    );
    insert into public.subscriptions(
      id,organization_id,provider_profile_id,plan_id,status,billing_model,starts_at,ends_at,updated_at
    ) values(
      gen_random_uuid(),organization_id,null,plan_id,'TRIAL','FLAT_MONTHLY',started_at,ends_at,started_at
    );
  else
    provider_profile_id:=gen_random_uuid();
    insert into public.provider_profiles(
      id,user_id,business_name,handle,verified_identity,verified_license,
      vehicle_documents_verified,phone,about,public_visibility,created_at
    ) values(
      provider_profile_id,actor_user_id,intent.business_name,owner_handle,false,false,false,null,
      case when intent.application_type='OWNER_OPERATOR'
        then 'Complete your owner-operator profile and submit current documents before publishing.'
        else 'Complete your self-managed Driver profile and submit current documents before publishing.' end,
      'PUBLIC',started_at
    );
    insert into public.company_pages(
      id,organization_id,provider_profile_id,headline,about,published,updated_at
    ) values(
      gen_random_uuid(),null,provider_profile_id,
      case when intent.application_type='OWNER_OPERATOR'
        then 'Owner-operated transport services' else 'Self-managed transport services' end,
      'Complete this transporter profile before publishing.',false,started_at
    );
    insert into public.subscriptions(
      id,organization_id,provider_profile_id,plan_id,status,billing_model,starts_at,ends_at,updated_at
    ) values(
      gen_random_uuid(),null,provider_profile_id,plan_id,'TRIAL','FLAT_MONTHLY',started_at,ends_at,started_at
    );
  end if;

  insert into public.applications(
    id,user_id,business_name,application_type,status,sponsored_free,notes,created_at,updated_at
  ) values(
    application_id,actor_user_id,intent.business_name,intent.application_type,'APPROVED',false,
    intent.notes,started_at,started_at
  );

  update public.profiles set
    email=lower(trim(auth_user.email)),full_name=intent.full_name,phone=intent.phone,
    role=target_role,active=true
  where id=actor_user_id;
  update public.provider_signup_intents set
    consumed_at=started_at,auth_user_id=actor_user_id
  where id=intent.id;
  insert into public.audit_logs(
    id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at
  ) values(
    gen_random_uuid(),actor_user_id,organization_id,'ACCOUNT_SELF_PROVISIONED','application',application_id,
    jsonb_build_object(
      'applicationType',intent.application_type,'providerProfileId',provider_profile_id,
      'accessStatus','TRIAL','accessEndsAt',ends_at
    ),started_at
  );
  return jsonb_build_object(
    'applicationId',application_id,'organizationId',organization_id,
    'providerProfileId',provider_profile_id,'role',target_role,
    'trialEndsAt',ends_at
  );
end;
$$;

revoke all on function public.bootstrap_loadgistic_auth_profile() from public,anon,authenticated;
revoke all on function public.prepare_provider_signup_intent(text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.complete_provider_signup(uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_provider_signup_intent(text,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.complete_provider_signup(uuid,text) to service_role;

comment on table public.provider_signup_intents is
  'Short-lived server-only provider facts awaiting a verified Supabase Auth identity. Raw browser tokens are never persisted.';
comment on function public.complete_provider_signup(uuid,text) is
  'Atomically provisions one provider workspace, draft public page, approved signup record, seven-day trial, active profile, and audit record.';
comment on function public.current_user_projection() is
  'Returns only the caller identity/workspace projection. An inactive bootstrap profile has no Loadgistic operating authority.';
