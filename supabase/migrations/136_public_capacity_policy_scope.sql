-- FEAT-PLY-001: profile visibility and signal sharing are separate contracts.
-- Remove moderated/demo content from public map/search before counting/paging.
create function public.capacity_public_policy_allows(target_vehicle_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from vehicles v
 left join organizations o on o.id=v.organization_id left join provider_profiles p on p.id=v.provider_profile_id
 where v.id=target_vehicle_id and not coalesce(o.content_hidden,p.content_hidden,false)
 and not coalesce(o.review_workspace,p.review_workspace,false))
$$;
revoke all on function public.capacity_public_policy_allows(uuid) from public,anon,authenticated;
grant execute on function public.capacity_public_policy_allows(uuid) to service_role;
do $migration$
declare definition text;signature text;anchor text:='where capacity.latest_position=1 and vehicle.active';
begin
 foreach signature in array array['public.public_capacity_page(jsonb,timestamp with time zone,uuid,integer)',
 'public.capacity_search_public_rows(jsonb,timestamp with time zone,uuid,integer)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'PUBLIC_CAPACITY_POLICY_ANCHOR_DRIFT: %',signature;end if;
  -- Set-based anti-joins inspect the vehicle's actual owner. Do not execute a
  -- definer RPC per candidate: that repeats catalog lookups on large markets.
  execute replace(definition,anchor,anchor||E'\n    and not exists(select 1 from public.organizations blocked where blocked.id=vehicle.organization_id and (blocked.content_hidden or blocked.review_workspace))\n    and not exists(select 1 from public.provider_profiles blocked where blocked.id=vehicle.provider_profile_id and (blocked.content_hidden or blocked.review_workspace))');
 end loop;
end $migration$;
notify pgrst,'reload schema';
