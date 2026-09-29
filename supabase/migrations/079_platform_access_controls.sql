-- FEAT-BIL-001 / FEAT-FTR-001: explicit launch controls, not forged subscriptions.
create table public.platform_controls (
  singleton boolean primary key default true check(singleton),
  access_mode text not null default 'FREE' check(access_mode in ('FREE','TRIAL_PAYMENT')),
  access_activated_at timestamptz,
  featured_mode text not null default 'AUTO' check(featured_mode in ('AUTO','MANUAL')),
  featured_target_count integer not null default 8 check(featured_target_count between 1 and 12),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.platform_controls(singleton) values(true);
alter table public.platform_controls enable row level security;
revoke all on public.platform_controls from public,anon,authenticated;
grant select on public.platform_controls to service_role;

create function public.managed_platform_controls(actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.profiles where id=actor_user_id and active and role::text='ADMIN') then raise exception 'FORBIDDEN'; end if;
  return (select to_jsonb(controls) from public.platform_controls controls where singleton);
end $$;

create function public.save_managed_platform_controls(actor_user_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prior public.platform_controls%rowtype;mode_value text;count_value integer;result jsonb;
begin
  if not exists(select 1 from public.profiles where id=actor_user_id and active and role::text='ADMIN') then raise exception 'FORBIDDEN'; end if;
  select * into strict prior from public.platform_controls where singleton for update;
  if command->>'section'='ACCESS' then
    mode_value:=command->>'mode';
    if mode_value is null or mode_value not in ('FREE','TRIAL_PAYMENT') then raise exception 'INVALID_PLATFORM_CONTROLS'; end if;
    if mode_value='TRIAL_PAYMENT' and prior.access_mode='FREE' and command->>'confirm' is distinct from 'ENABLE' then raise exception 'ACCESS_ACTIVATION_CONFIRMATION_REQUIRED'; end if;
    if mode_value=prior.access_mode then return to_jsonb(prior); end if;
    update public.platform_controls set access_mode=mode_value,
      access_activated_at=case when mode_value='TRIAL_PAYMENT' then now() else access_activated_at end,
      updated_at=now(),updated_by=actor_user_id where singleton returning to_jsonb(platform_controls) into result;
  elsif command->>'section'='FEATURED' then
    mode_value:=command->>'mode';
    begin count_value:=(command->>'target_count')::integer; exception when others then raise exception 'INVALID_PLATFORM_CONTROLS'; end;
    if mode_value is null or mode_value not in ('AUTO','MANUAL') or count_value is null or count_value not between 1 and 12 then raise exception 'INVALID_PLATFORM_CONTROLS'; end if;
    if mode_value=prior.featured_mode and count_value=prior.featured_target_count then return to_jsonb(prior); end if;
    update public.platform_controls set featured_mode=mode_value,featured_target_count=count_value,
      updated_at=now(),updated_by=actor_user_id where singleton returning to_jsonb(platform_controls) into result;
  else raise exception 'INVALID_PLATFORM_CONTROLS'; end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,details)
    values(actor_user_id,'PLATFORM_CONTROLS_UPDATED','platform_controls',jsonb_build_object('section',command->>'section','before',to_jsonb(prior)-'updated_by','after',result-'updated_by'));
  return result;
end $$;

create function public.subscription_is_usable(subscription public.subscriptions)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select subscription.id is not null and (
    controls.access_mode='FREE' or subscription.status='SPONSORED'
    or subscription.status in ('TRIAL','ACTIVE') and subscription.ends_at>now()
    or controls.access_activated_at+interval '7 days'>now()
  ) from public.platform_controls controls where singleton
$$;

-- Keep browser identity, RLS, and all managed operating scopes in agreement.
do $migration$
declare signature text;definition text;old_fragment text;new_fragment text;
begin
  for signature,old_fragment,new_fragment in values
    ('public.provider_capacity_actor_scope(uuid)',
      'subscription.status=''SPONSORED'''||E'\n          '||'or subscription.status in (''TRIAL'',''ACTIVE'') and subscription.ends_at>now()',
      'public.subscription_is_usable(subscription)'),
    ('public.provider_tracking_actor_scope(uuid)',
      'subscription.status=''SPONSORED'''||E'\n          '||'or subscription.status in (''TRIAL'',''ACTIVE'') and subscription.ends_at>now()',
      'public.subscription_is_usable(subscription)'),
    ('public.provider_profile_actor_scope(uuid)',
      'subscription.status=''SPONSORED'''||E'\n          '||'or subscription.status in (''TRIAL'',''ACTIVE'') and subscription.ends_at>now()',
      'public.subscription_is_usable(subscription)'),
    ('public.has_workspace_access()',
      's.status=''SPONSORED'' or (s.status in (''TRIAL'',''ACTIVE'') and s.ends_at>now())',
      'public.subscription_is_usable(s)'),
    ('public.current_user_projection()',
      '''workspace_subscription'',',
      '''access_policy'',(select jsonb_build_object(''mode'',access_mode,''activated_at'',access_activated_at) from public.platform_controls where singleton),''workspace_subscription'','),
    ('public.submit_managed_payment_proof(uuid,jsonb)',
      'if subscription_record.status=''SPONSORED'' then raise exception ''PAYMENT_NOT_REQUIRED''; end if;',
      'if subscription_record.status=''SPONSORED'' or (select access_mode=''FREE'' from public.platform_controls where singleton) then raise exception ''PAYMENT_NOT_REQUIRED''; end if;')
  loop
    definition:=pg_get_functiondef(signature::regprocedure);
    if position(old_fragment in definition)=0 then raise exception 'PLATFORM_ACCESS_CONTRACT_NOT_FOUND: %',signature; end if;
    execute replace(definition,old_fragment,new_fragment);
  end loop;
end $migration$;

revoke all on function public.managed_platform_controls(uuid),public.save_managed_platform_controls(uuid,jsonb),public.subscription_is_usable(public.subscriptions) from public,anon,authenticated;
grant execute on function public.managed_platform_controls(uuid),public.save_managed_platform_controls(uuid,jsonb) to service_role;
