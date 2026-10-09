-- Local disposable fixtures only. All commercial and roster changes roll back.
begin;
do $test$
declare admin_id uuid;owner_id uuid;driver_id uuid;subscription_record public.subscriptions%rowtype;
  initial_end timestamptz;activated timestamptz;first_result jsonb;repeat_result jsonb;
  today date:=(now() at time zone 'Africa/Addis_Ababa')::date;manual_id uuid;theme jsonb;roster_before jsonb;roster_after jsonb;
begin
  select id into strict admin_id from public.profiles where active and role='ADMIN' order by created_at,id limit 1;
  select id into strict owner_id from public.profiles where active and role='TRANSPORTER' and exists(select 1 from public.organization_members m where m.user_id=profiles.id) order by created_at,id limit 1;
  select id into strict driver_id from public.profiles where active and role='DRIVER' and exists(select 1 from public.organization_members m where m.user_id=profiles.id) order by created_at,id limit 1;
  select subscription.* into strict subscription_record from public.subscriptions subscription
    join public.organization_members member on member.organization_id=subscription.organization_id where member.user_id=owner_id;
  update public.subscriptions set status='PAYMENT_REQUIRED',ends_at=now()-interval '30 days' where id=subscription_record.id;
  if not (select workspace_access from public.provider_capacity_actor_scope(driver_id))
    or not (select workspace_access from public.provider_tracking_actor_scope(owner_id))
    or not (select workspace_access from public.provider_profile_actor_scope(owner_id)) then raise exception 'FREE_WORKSPACE_BLOCKED';end if;
  begin
    perform public.save_managed_platform_controls(owner_id,'{"section":"ACCESS","mode":"TRIAL_PAYMENT","confirm":"ENABLE"}');
    raise exception 'NONADMIN_SETTINGS_ALLOWED';
  exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
  begin
    perform public.submit_managed_payment_proof(owner_id,'{"amount_minor":1000}');
    raise exception 'RETIRED_PAYMENT_ALLOWED';
  exception when raise_exception then if sqlerrm<>'BILLING_RETIRED' then raise;end if;end;
  begin
    perform public.save_managed_platform_controls(admin_id,'{"section":"ACCESS","mode":"TRIAL_PAYMENT","confirm":"ENABLE"}');
    raise exception 'RETIRED_ACTIVATION_ALLOWED';
  exception when raise_exception then if sqlerrm<>'BILLING_RETIRED' then raise;end if;end;
  if exists(select 1 from public.platform_controls where access_mode<>'FREE') then raise exception 'PAID_MODE_ENABLED';end if;

  -- Only temporary metadata inside this rollback is removed to exercise a fresh week.
  delete from public.featured_provider_days where feature_date between today and today+6;
  theme:=public.featured_truck_theme(today);
  manual_id:=public.save_managed_featured_truck_day(admin_id,jsonb_build_object('feature_date',today,'target_count',5,
    'theme_key',theme->>'key','theme_label',theme->>'label','theme_configurations',theme->'configurations','truck_keys','[]'::jsonb,'publish',false,
    'schedule_config',jsonb_build_object('dayStart','08:30','dayEnd','12:00','targetCount',5,'sponsorBreakCount',4,'sponsorBreakMinutes',2)));
  perform public.save_managed_platform_controls(admin_id,'{"section":"FEATURED","mode":"MANUAL","target_count":5}');
  if (public.generate_managed_featured_days()->>'created')::integer<>0 then raise exception 'MANUAL_MODE_GENERATED';end if;
  perform public.save_managed_platform_controls(admin_id,'{"section":"FEATURED","mode":"AUTO","target_count":5}');
  first_result:=public.generate_managed_featured_days();
  if (first_result->>'created')::integer<1 then raise exception 'NO_AUTOMATIC_DAYS_GENERATED';end if;
  if not exists(select 1 from public.featured_provider_days where id=manual_id and status='DRAFT' and selection_source='MANUAL') then raise exception 'MANUAL_DRAFT_OVERWRITTEN';end if;
  if exists(select 1 from public.featured_provider_slots slot join public.featured_provider_days day on day.id=slot.day_id where day.selection_source='AUTO'
    and (slot.driver_user_id is distinct from public.capacity_active_driver_id(slot.vehicle_id))) then raise exception 'INVALID_AUTO_DRIVER';end if;
  if exists(select day_id from public.featured_provider_slots group by day_id having count(*)<>count(distinct driver_user_id)) then raise exception 'REPEATED_DRIVER';end if;
  if exists(select 1 from public.featured_provider_days day where day.selection_source='AUTO' and ((day.feature_date between today and today+6 and target_count>5)
    or target_count<>(select count(*) from public.featured_provider_slots where day_id=day.id))) then raise exception 'AUTO_COUNT_INVALID';end if;
  select jsonb_agg(to_jsonb(slot) order by slot.id) into roster_before from public.featured_provider_slots slot
    join public.featured_provider_days day on day.id=slot.day_id where day.feature_date between today and today+6;
  repeat_result:=public.generate_managed_featured_days();
  select jsonb_agg(to_jsonb(slot) order by slot.id) into roster_after from public.featured_provider_slots slot
    join public.featured_provider_days day on day.id=slot.day_id where day.feature_date between today and today+6;
  if (repeat_result->>'created')::integer<>0 or roster_before is distinct from roster_after then raise exception 'AUTO_RETRY_CHANGED_ROSTER';end if;
  if has_function_privilege('anon','public.generate_managed_featured_days()','EXECUTE')
    or has_function_privilege('authenticated','public.save_managed_platform_controls(uuid,jsonb)','EXECUTE') then raise exception 'PLATFORM_CONTROL_EXPOSED';end if;
  raise notice 'PASS: plan-free access, retired charging/activation, retained history, automatic rosters, distinct Drivers, manual override, retry and browser denial';
end $test$;
rollback;
