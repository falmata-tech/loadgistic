-- FEAT-CAP-001: a new Partial publication requires a valid attributed estimate.
begin;
select pg_advisory_xact_lock(8030242);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $migration$
declare
  publish_oid regprocedure:='public.publish_provider_capacity_pre_radius163(uuid,jsonb)'::regprocedure;
  duty_oid regprocedure:='public.set_provider_assigned_vehicle_duty_pre_phone157(uuid,jsonb)'::regprocedure;
  original text;
  patched text;
  previous text;
  requested text;
begin
  original:=pg_get_functiondef(publish_oid);
  if md5(original)<>'591a3c164d6030495a672f381fe4371f' then
    raise exception 'CAPACITY242_PUBLISH_DEFINITION_DRIFT';
  end if;
  previous:=$old$      reported_driver:=assigned_driver;
    end if;
  end if;

  update public.capacities set expires_at=timestamp_value$old$;
  requested:=$new$      reported_driver:=assigned_driver;
    end if;
    if reported_percent is null or reported_stamp is null
      then raise exception 'INVALID_AVAILABLE_PERCENT';end if;
  end if;

  update public.capacities set expires_at=timestamp_value$new$;
  if (length(original)-length(replace(original,previous,'')))/length(previous)<>1
    then raise exception 'CAPACITY242_PUBLISH_CHECK_DRIFT';end if;
  patched:=replace(original,previous,requested);
  patched:=replace(patched,'coalesce(reported_percent,50)','reported_percent');
  if strpos(patched,'coalesce(reported_percent,50)')<>0
    then raise exception 'CAPACITY242_PUBLISH_DEFAULT_DRIFT';end if;
  execute patched;

  original:=pg_get_functiondef(duty_oid);
  if md5(original)<>'3d4093df1f65a872a28a2070d4a78141' then
    raise exception 'CAPACITY242_DUTY_DEFINITION_DRIFT';
  end if;
  previous:=$old$    if not found then raise exception 'CAPACITY_CONFIGURATION_REQUIRED'; end if;
    if coalesce($old$;
  requested:=$new$    if not found then raise exception 'CAPACITY_CONFIGURATION_REQUIRED'; end if;
    if coalesce(source.market_status,source.status::text)='PARTIAL' and (
      source.available_percent_reported_at is null or source.available_percent_reported_by is null
      or source.available_percent_reported_driver_id is distinct from actor_user_id
    ) then raise exception 'CAPACITY_AVAILABLE_SPACE_CONFIGURATION_REQUIRED'; end if;
    if coalesce($new$;
  if (length(original)-length(replace(original,previous,'')))/length(previous)<>1
    then raise exception 'CAPACITY242_DUTY_CHECK_DRIFT';end if;
  patched:=replace(original,previous,requested);
  previous:=$old$id,provider_organization_id,provider_profile_id,vehicle_id,status,market_status,available_percent,
    origin$old$;
  requested:=$new$id,provider_organization_id,provider_profile_id,vehicle_id,status,market_status,available_percent,
    available_percent_reported_at,available_percent_reported_by,available_percent_reported_driver_id,
    origin$new$;
  if (length(patched)-length(replace(patched,previous,'')))/length(previous)<>1
    then raise exception 'CAPACITY242_DUTY_COLUMNS_DRIFT';end if;
  patched:=replace(patched,previous,requested);
  previous:=$old$    case when on_duty then source.available_percent else 0 end,
    null,null,null,null,null,source.visibility,null,$old$;
  requested:=$new$    case when on_duty then source.available_percent else 0 end,
    case when on_duty then source.available_percent_reported_at end,
    case when on_duty then source.available_percent_reported_by end,
    case when on_duty then source.available_percent_reported_driver_id end,
    null,null,null,null,null,source.visibility,null,$new$;
  if (length(patched)-length(replace(patched,previous,'')))/length(previous)<>1
    then raise exception 'CAPACITY242_DUTY_INSERT_DRIFT';end if;
  execute replace(patched,previous,requested);
end
$migration$;

commit;
