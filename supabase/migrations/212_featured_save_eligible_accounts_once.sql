-- FEAT-FTR-001: keep every selected-vehicle authority check while avoiding
-- repeated full-account eligibility scans during an eight-account save.
begin;
select pg_advisory_xact_lock(8030180);

do $guard$
declare definition text:=pg_get_functiondef('public.save_managed_featured_provider_day(uuid,jsonb)'::regprocedure);
begin
  if strpos(definition,'select link.provider_key into account_value from public.featured_eligible_account_links() link')=0
    or strpos(definition,'not public.capacity_public_policy_allows(vehicle_value)')=0
    or strpos(definition,'public.featured_eligible_truck_links(array[vehicle_record.cargo_configuration])')=0
    or strpos(definition,'day_id:=public.save_managed_featured_truck_day(actor_user_id,prepared)')=0
    then raise exception 'FEATURED_SAVE_ELIGIBILITY_PATCH_PRECONDITION';end if;
end $guard$;

create or replace function public.save_managed_featured_provider_day(actor_user_id uuid,command jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare key_value text;vehicle_value uuid;account_value text;selected_accounts text[]:=array[]::text[];
  vehicle_record public.vehicles%rowtype;eligible_accounts jsonb;
  configurations jsonb;day_id uuid;prepared jsonb;feature_day date;published boolean;
begin
  perform public.lock_featured_actor(actor_user_id);
  if jsonb_typeof(command->'truck_keys')<>'array' then raise exception 'FEATURED_TRUCK_INVALID';end if;
  -- The SQL eligibility function is SECURITY DEFINER and authoritative. Its
  -- complete result is reused only inside this one locked save transaction.
  select coalesce(jsonb_agg(to_jsonb(link) order by link.provider_key,link.vehicle_id),'[]'::jsonb)
    into eligible_accounts from public.featured_eligible_account_links() link;
  for key_value in select value from jsonb_array_elements_text(command->'truck_keys') value loop
    begin vehicle_value:=replace(key_value,'vehicle:','')::uuid;
    exception when others then raise exception 'FEATURED_TRUCK_INVALID';end;
    if key_value<>'vehicle:'||vehicle_value::text then raise exception 'FEATURED_TRUCK_INVALID';end if;
    select * into vehicle_record from public.vehicles where id=vehicle_value and active;
    if not found then raise exception 'FEATURED_PROVIDER_INELIGIBLE';end if;
    select link.provider_key into account_value
      from jsonb_to_recordset(eligible_accounts) as link(
        provider_key text,provider_organization_id uuid,provider_profile_id uuid)
      where link.provider_organization_id=vehicle_record.organization_id
        or link.provider_profile_id=vehicle_record.provider_profile_id;
    if account_value is not null and (
      not public.capacity_public_policy_allows(vehicle_value)
      or not exists(select 1 from public.featured_eligible_truck_links(array[vehicle_record.cargo_configuration]) eligible
        where eligible.vehicle_id=vehicle_value)
    ) then account_value:=null;end if;
    if account_value is null then raise exception 'FEATURED_PROVIDER_INELIGIBLE';end if;
    if account_value=any(selected_accounts) then raise exception 'FEATURED_PROVIDER_DUPLICATE';end if;
    selected_accounts:=array_append(selected_accounts,account_value);
  end loop;
  -- Refresh account eligibility immediately before the writer. Vehicle policy
  -- and assignment checks above, plus the retained slot-writer checks below,
  -- still apply to each selected vehicle; a revoked account never publishes
  -- merely because it was eligible at the start of this command.
  if exists(
    with current_accounts as materialized (
      select provider_key from public.featured_eligible_account_links()
    )
    select 1 from unnest(selected_accounts) selected(provider_key)
    left join current_accounts current_link on current_link.provider_key=selected.provider_key
    where current_link.provider_key is null)
    then raise exception 'FEATURED_PROVIDER_INELIGIBLE';end if;
  select coalesce(jsonb_agg(configuration),'[]'::jsonb) into configurations
    from (select distinct cargo_configuration as configuration from public.vehicles where active) current_types;
  prepared:=command||jsonb_build_object('theme_key','provider-accounts',
    'theme_label','Transport Providers','theme_configurations',configurations);
  day_id:=public.save_managed_featured_truck_day(actor_user_id,prepared);
  select day.feature_date,day.status='PUBLISHED' into feature_day,published
    from public.featured_provider_days day where day.id=day_id;
  delete from public.featured_account_manual_selections where featured_day_id=day_id;
  if published then
    insert into public.featured_account_manual_selections(featured_day_id,provider_key,feature_date)
      select day_id,unnest(selected_accounts),feature_day;
    insert into public.featured_account_rotation_selections
      (round_number,provider_key,featured_day_id,first_feature_date,origin)
      select (select coalesce(max(round_number),1) from public.featured_account_rotation_selections),
        account,day_id,feature_day,'MANUAL'
      from unnest(selected_accounts) account
      on conflict(round_number,provider_key) do nothing;
  end if;
  return day_id;
end $$;
revoke all on function public.save_managed_featured_provider_day(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_managed_featured_provider_day(uuid,jsonb) to service_role;
commit;
