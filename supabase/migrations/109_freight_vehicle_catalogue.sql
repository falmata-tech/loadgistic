-- FEAT-FLT-001 / FEAT-FTR-001: retire courier selection, retain historical records.
-- Common write boundary also covers older registration/edit clients and service imports.
create function public.reject_retired_vehicle_configuration()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.cargo_configuration in ('Courier car','Courier motorcycle') then
    if tg_op='INSERT' then raise exception 'INVALID_VEHICLE_CONFIGURATION'; end if;
    if new.cargo_configuration is distinct from old.cargo_configuration then
      raise exception 'INVALID_VEHICLE_CONFIGURATION';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.reject_retired_vehicle_configuration() from public,anon,authenticated;
create trigger reject_retired_vehicle_configuration
before insert or update of cargo_configuration on public.vehicles
for each row execute function public.reject_retired_vehicle_configuration();

create or replace function public.featured_truck_theme(feature_day date)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
  select jsonb_build_object('key',theme.key,'label',theme.label,'configurations',theme.configurations)
  from (values
    (1,'mini-trucks','Mini trucks',array['Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck']),
    (2,'cargo-vans','Cargo vans',array['Cargo van']),
    (3,'pickups','Pickup trucks',array['Pickup truck','Pickup stake body']),
    (4,'light-duty','Light-duty trucks',array['Light Box Truck','Light Stake Body Truck']),
    (5,'medium-duty','Medium-duty trucks',array['Medium Box Truck','Medium Stake Body Truck']),
    (6,'heavy-trucks','Heavy trucks',array['Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer','Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer']),
    (7,'mixed-trucks','Mixed trucks',array['Cargo van','Pickup truck','Pickup stake body','Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck','Light Stake Body Truck','Light Box Truck','Medium Stake Body Truck','Medium Box Truck','Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer','Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer'])
  ) theme(weekday,key,label,configurations) where theme.weekday=extract(isodow from feature_day)
$$;

-- Existing saved rosters and real vehicle records are intentionally preserved.
