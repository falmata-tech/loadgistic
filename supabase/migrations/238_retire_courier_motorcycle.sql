-- FEAT-CAP/FLT/FTR-001: retain Courier car and retire the motorcycle choice.
-- Update only catalogue validation and future rotation. Preserve saved records.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(8030238);

-- Patch the installed allowlists in place to preserve later authority and
-- location-source changes, along with existing function ACLs.
do $remove_courier_motorcycle$
declare
 routine regprocedure;
 definition text;
 retired text:=$entry$'Courier motorcycle',$entry$;
begin
 foreach routine in array array[
  'public.create_provider_vehicle(uuid,jsonb)'::regprocedure,
  'public.update_provider_vehicle_details(uuid,jsonb)'::regprocedure,
  'public.capacity_filter_values(text,text)'::regprocedure
 ] loop
  definition:=pg_get_functiondef(routine);
  if (length(definition)-length(replace(definition,retired,'')))/length(retired)<>1 then
   raise exception 'COURIER_CONFIGURATION_CATALOGUE_DRIFT: %',routine;
  end if;
  execute replace(definition,retired,'');
 end loop;
end $remove_courier_motorcycle$;

create or replace function public.featured_truck_theme(feature_day date)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
 select jsonb_build_object('key',theme.key,'label',theme.label,'configurations',theme.configurations)
 from (values
  (1,'mini-trucks','Mini trucks',array['Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck']),
  (2,'cargo-vans','Vans and couriers',array['Cargo van','Courier car']),
  (3,'pickups','Pickup trucks',array['Pickup truck','Pickup stake body']),
  (4,'light-duty','Light-duty trucks',array['Light Box Truck','Light Stake Body Truck']),
  (5,'medium-duty','Medium-duty trucks',array['Medium Box Truck','Medium Stake Body Truck']),
  (6,'heavy-trucks','Heavy trucks',array['Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer','Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer']),
  (7,'mixed-trucks','Mixed trucks',array['Courier car','Cargo van','Pickup truck','Pickup stake body','Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck','Light Stake Body Truck','Light Box Truck','Medium Stake Body Truck','Medium Box Truck','Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer','Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer'])
 ) theme(weekday,key,label,configurations) where theme.weekday=extract(isodow from feature_day)
$$;

notify pgrst,'reload schema';
commit;
