-- Area-based regular capacity uses the same center as its origin and
-- destination. Route-based capacity must still describe two distinct places.

alter table public.profile_routes
  drop constraint if exists profile_route_distinct_places;

alter table public.profile_routes
  add constraint profile_route_distinct_places
  check (
    geometry = 'RADIUS'
    or lower(trim(origin)) <> lower(trim(destination))
  );
