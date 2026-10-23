-- FEAT-CAP/FLT/FTR-001. Restore supported courier configurations without
-- rewriting vehicles, driver assignments, source settings or saved programmes.
begin;
select pg_advisory_xact_lock(8030168);
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Expand the installed, fully guarded commands instead of copying an older
-- version that lacks publication, authority or unfinished-Tracking protections.
do $courier_commands$
declare routine regprocedure;definition text;before_text text:=$before$'Courier car','Cargo van'$before$;
 after_text text:=$after$'Courier motorcycle','Courier car','Cargo van'$after$;
begin
 foreach routine in array array['public.create_provider_vehicle(uuid,jsonb)'::regprocedure,'public.update_provider_vehicle_details(uuid,jsonb)'::regprocedure] loop
  definition:=pg_get_functiondef(routine);
  if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'COURIER_CONFIGURATION_COMMAND_DRIFT';end if;
  execute replace(definition,before_text,after_text);
 end loop;
end $courier_commands$;

-- This trigger's sole purpose was to reject these two otherwise valid types.
-- Existing owner-scoped command allowlists remain the write validation boundary.
drop trigger reject_retired_vehicle_configuration on public.vehicles;
drop function public.reject_retired_vehicle_configuration();

create or replace function public.capacity_filter_values(value text,filter_key text) returns text[]
language plpgsql immutable set search_path=public,pg_temp as $$
declare allowed text[];parts text[];token text;result text[]:=array[]::text[];
begin
 allowed:=case filter_key
  when 'status' then array['EMPTY','PARTIAL'] when 'load_type' then array['FTL','PTL']
  when 'stop_option' then array['MULTI_PICK','MULTI_DROP'] when 'freshness' then array['FRESH','UPDATE_NEEDED']
  when 'vehicle_category' then array['Courier motorcycle','Courier car','Cargo van','Pickup truck','Pickup stake body','Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck',
   'Light Stake Body Truck','Light Box Truck','Medium Stake Body Truck','Medium Box Truck','Heavy Rigid Stake Body Truck',
   'Heavy Rigid Stake Body Truck + Trailer','Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer']
  else null end;
 if allowed is null then raise exception 'INVALID_CAPACITY_FILTER';end if;
 if value is null then return null;end if;
 if length(value)>2048 then raise exception 'INVALID_CAPACITY_FILTER';end if;
 if trim(value)='' then return null;end if;
 parts:=string_to_array(value,',');
 if cardinality(parts)>32 then raise exception 'INVALID_CAPACITY_FILTER';end if;
 foreach token in array parts loop
  if length(token)>128 then raise exception 'INVALID_CAPACITY_FILTER';end if;
  token:=case when filter_key='vehicle_category' then trim(token) else upper(trim(token)) end;
  if token='' or not(token=any(allowed)) then raise exception 'INVALID_CAPACITY_FILTER';end if;
  if not(token=any(result)) then result:=array_append(result,token);end if;
 end loop;
 return array(select item from unnest(result) item order by item collate "C");
end $$;

create or replace function public.featured_truck_theme(feature_day date)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
 select jsonb_build_object('key',theme.key,'label',theme.label,'configurations',theme.configurations)
 from (values
  (1,'mini-trucks','Mini trucks',array['Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck']),
  (2,'cargo-vans','Vans and couriers',array['Cargo van','Courier car','Courier motorcycle']),
  (3,'pickups','Pickup trucks',array['Pickup truck','Pickup stake body']),
  (4,'light-duty','Light-duty trucks',array['Light Box Truck','Light Stake Body Truck']),
  (5,'medium-duty','Medium-duty trucks',array['Medium Box Truck','Medium Stake Body Truck']),
  (6,'heavy-trucks','Heavy trucks',array['Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer','Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer']),
  (7,'mixed-trucks','Mixed trucks',array['Courier motorcycle','Courier car','Cargo van','Pickup truck','Pickup stake body','Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck','Light Stake Body Truck','Light Box Truck','Medium Stake Body Truck','Medium Box Truck','Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer','Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer'])
 ) theme(weekday,key,label,configurations) where theme.weekday=extract(isodow from feature_day)
$$;

-- CREATE OR REPLACE preserves current ACLs, including the internal filter
-- helper's no-browser/no-service direct execution policy.
notify pgrst,'reload schema';
commit;
