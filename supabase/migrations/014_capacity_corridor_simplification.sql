-- Simplify public capacity to one current radius/corridor plus at most two
-- provider-level regular corridors. Retired signal data is intentionally removed.

drop table if exists public.next_trips cascade;
drop table if exists public.recurring_service_areas cascade;

delete from public.profile_routes
where id in (
  select id from (
    select id,
      row_number() over (
        partition by coalesce('org:' || organization_id::text,'profile:' || provider_profile_id::text)
        order by created_at desc,id desc
      ) as position
    from public.profile_routes
  ) ranked
  where position > 2
);

create or replace function public.enforce_regular_corridor_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.profile_routes route
    where (new.organization_id is not null and route.organization_id = new.organization_id)
       or (new.provider_profile_id is not null and route.provider_profile_id = new.provider_profile_id)
  ) >= 2 then
    raise exception 'REGULAR_CORRIDOR_LIMIT';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_routes_max_two on public.profile_routes;
create trigger profile_routes_max_two
before insert on public.profile_routes
for each row execute function public.enforce_regular_corridor_limit();
