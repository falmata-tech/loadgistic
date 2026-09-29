-- FEAT-CAP-001: a non-location edit must not claim a fresh Driver fix.
-- Reuse the existing authorized latest-Driver-location branch, including its
-- original timestamp. New Driver fixes still require DEVICE_OBSCURED.
do $migration$
declare
  definition text;
  prior_branch text:=$fragment$if actor.actor_role='DRIVER' then
      if command->>'location_source'<>'DEVICE_OBSCURED'$fragment$;
  focused_branch text:=$fragment$if actor.actor_role='DRIVER' and coalesce(command->>'location_source','')<>'PRESERVE_DRIVER' then
      if command->>'location_source'<>'DEVICE_OBSCURED'$fragment$;
begin
  definition:=pg_get_functiondef('public.publish_provider_capacity(uuid,jsonb)'::regprocedure);
  if position(prior_branch in definition)=0 then raise exception 'CAPACITY_LOCATION_BRANCH_NOT_FOUND'; end if;
  execute replace(definition,prior_branch,focused_branch);
end;
$migration$;

-- A replacement is one transaction: invalid geometry or denied ownership
-- rolls back both the removal and its audit entry. Never remove in one HTTP
-- request and attempt to add in a second request for an ordinary edit.
create or replace function public.replace_provider_regular_capacity(actor_user_id uuid,target_route_id uuid,command jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  perform public.remove_provider_regular_capacity(actor_user_id,target_route_id);
  return public.add_provider_regular_capacity(actor_user_id,command);
end;
$$;

revoke all on function public.replace_provider_regular_capacity(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.replace_provider_regular_capacity(uuid,uuid,jsonb) to service_role;
