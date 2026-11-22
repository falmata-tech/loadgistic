-- FEAT-FTR-001. Keep the roster's exact eligibility checks and row locks.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $migration$
declare
  eligibility text := pg_get_functiondef('public.featured_eligible_truck_links(text[])'::regprocedure);
  generator text := pg_get_functiondef('public.generate_managed_featured_days_for_date(date)'::regprocedure);
  signature text := 'public.featured_eligible_truck_links(configurations text[])';
  filter_anchor text := 'where vehicle.active';
  recheck text := 'public.featured_eligible_truck_links(array[vehicle_record.cargo_configuration]) current_link';
begin
  if strpos(eligibility,signature)=0
    or (length(eligibility)-length(replace(eligibility,filter_anchor,'')))/length(filter_anchor)<>1
    or (length(generator)-length(replace(generator,recheck,'')))/length(recheck)<>1
  then
    raise exception 'FEATURED_SCOPED_RECHECK_DEFINITION_DRIFT';
  end if;

  execute replace(
    replace(eligibility,signature,'public.featured_eligible_truck_links_scoped(configurations text[], requested_vehicle_id uuid)'),
    filter_anchor,'where (requested_vehicle_id is null or vehicle.id=requested_vehicle_id) and vehicle.active'
  );
  execute replace(generator,recheck,
    'public.featured_eligible_truck_links_scoped(array[vehicle_record.cargo_configuration],choice.vehicle_id) current_link');
end $migration$;

create or replace function public.featured_eligible_truck_links(configurations text[])
returns table(vehicle_id uuid,driver_user_id uuid)
language sql stable security definer set search_path=public,pg_temp as $$
  select link.vehicle_id,link.driver_user_id
  from public.featured_eligible_truck_links_scoped(configurations,null) link
$$;

revoke all on function public.featured_eligible_truck_links_scoped(text[],uuid)
  from public,anon,authenticated,service_role;

commit;
