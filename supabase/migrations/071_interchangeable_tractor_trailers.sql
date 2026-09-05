-- FEAT-FLT-001 / FEAT-CAP-001 / FEAT-DAT-001
-- A tractor remains one vehicle while its currently attached compatible trailer
-- is the single configuration exposed to capacity, profile, and Featured reads.

alter table public.vehicles
  add column if not exists trailer_interchangeable boolean not null default false,
  add column if not exists supported_trailer_configurations text[] not null default '{}'::text[];

do $$
begin
  if not exists(
    select 1 from pg_constraint where conname='vehicles_trailer_configuration_consistency'
      and conrelid='public.vehicles'::regclass
  ) then
    alter table public.vehicles add constraint vehicles_trailer_configuration_consistency check(
      (
        not trailer_interchangeable
        and cardinality(supported_trailer_configurations)=0
        and coalesce(cargo_configuration,'')<>all(array[
          'Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer'
        ]::text[])
      ) or (
        trailer_interchangeable
        and category='Tractor'
        and cardinality(supported_trailer_configurations) between 1 and 3
        and cargo_configuration=any(supported_trailer_configurations)
        and supported_trailer_configurations<@array[
          'Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer'
        ]::text[]
      )
    ) not valid;
    alter table public.vehicles validate constraint vehicles_trailer_configuration_consistency;
  end if;
end;
$$;

create or replace function public.create_provider_vehicle(actor_user_id uuid,command jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  vehicle_id uuid:=gen_random_uuid();
  make_value text:=trim(coalesce(command->>'make',''));
  model_value text:=trim(coalesce(command->>'model',''));
  configuration_value text:=trim(coalesce(command->>'cargo_configuration',''));
  plate_value text:=trim(coalesce(command->>'plate',''));
  interchangeable_value boolean:=coalesce((command->>'trailer_interchangeable')::boolean,false);
  supported_value text[]:='{}'::text[];
  platform_number_value text;
  category_value text;
  tractor_configurations constant text[]:=array[
    'Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer'
  ]::text[];
begin
  -- cargo_configuration is the tractor's current configuration, never its whole compatible set.
  if command is null or jsonb_typeof(command)<>'object' then raise exception 'INVALID_VEHICLE_INPUT'; end if;
  if command?'supported_trailer_configurations' then
    if jsonb_typeof(command->'supported_trailer_configurations')<>'array' then
      raise exception 'INVALID_TRAILER_CONFIGURATION';
    end if;
    select coalesce(array_agg(distinct trim(item) order by trim(item)) filter(where trim(item)<>''),'{}'::text[])
    into supported_value from jsonb_array_elements_text(command->'supported_trailer_configurations') item;
  end if;
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;
  if actor.is_company_driver then raise exception 'FORBIDDEN'; end if;
  if actor.actor_role='TRANSPORTER' and not exists(
    select 1 from public.organization_members member
    where member.user_id=actor_user_id and member.organization_id=actor.organization_id
      and member.membership_role='OWNER'
  ) then raise exception 'FORBIDDEN'; end if;
  if actor.actor_role='DRIVER' and actor.provider_profile_id is null then raise exception 'FORBIDDEN'; end if;
  if char_length(make_value) not between 2 and 60 then raise exception 'INVALID_VEHICLE_MAKE'; end if;
  if char_length(model_value) not between 1 and 60 then raise exception 'INVALID_VEHICLE_MODEL'; end if;
  if char_length(plate_value) not between 2 and 32 then raise exception 'INVALID_VEHICLE_PLATE'; end if;
  if configuration_value<>all(array[
    'Courier car','Cargo van','Pickup truck','Pickup stake body',
    'Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck',
    'Light Stake Body Truck','Light Box Truck','Medium Stake Body Truck','Medium Box Truck',
    'Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer',
    'Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer'
  ]::text[]) then raise exception 'INVALID_VEHICLE_CONFIGURATION'; end if;
  if interchangeable_value then
    if configuration_value<>all(tractor_configurations)
      or cardinality(supported_value) not between 1 and 3
      or not supported_value<@tractor_configurations
      or configuration_value<>all(supported_value) then
      raise exception 'INVALID_TRAILER_CONFIGURATION';
    end if;
    category_value:='Tractor';
  else
    if configuration_value=any(tractor_configurations) or cardinality(supported_value)<>0 then
      raise exception 'INVALID_TRAILER_CONFIGURATION';
    end if;
    category_value:=configuration_value;
  end if;

  platform_number_value:='LG-TRK-'||upper(substr(replace(vehicle_id::text,'-',''),1,10));
  insert into public.vehicles(
    id,organization_id,provider_profile_id,label,category,make,model,cargo_configuration,plate,
    platform_number,active,trailer_interchangeable,supported_trailer_configurations
  ) values (
    vehicle_id,actor.organization_id,actor.provider_profile_id,
    concat_ws(' ',make_value,model_value),category_value,make_value,model_value,
    configuration_value,plate_value,platform_number_value,true,interchangeable_value,supported_value
  );
  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,actor.organization_id,'PROVIDER_VEHICLE_CREATED','vehicle',vehicle_id,
    jsonb_build_object('platformNumber',platform_number_value,'cargoConfiguration',configuration_value,
      'trailerInterchangeable',interchangeable_value,'supportedTrailerConfigurations',supported_value),now());
  return jsonb_build_object(
    'id',vehicle_id,'platform_number',platform_number_value,'make',make_value,'model',model_value,
    'cargo_configuration',configuration_value,'trailer_interchangeable',interchangeable_value,
    'supported_trailer_configurations',supported_value,'active',true
  );
end;
$$;

create or replace function public.set_provider_vehicle_attached_trailer(actor_user_id uuid,command jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  vehicle public.vehicles%rowtype;
  target_vehicle_id uuid;
  configuration_value text:=trim(coalesce(command->>'cargo_configuration',''));
  previous_configuration text;
begin
  if command is null or jsonb_typeof(command)<>'object' then raise exception 'INVALID_VEHICLE_INPUT'; end if;
  begin target_vehicle_id:=(command->>'vehicle_id')::uuid;
  exception when others then raise exception 'NOT_FOUND'; end;
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;
  if actor.is_company_driver then raise exception 'FORBIDDEN'; end if;
  if actor.actor_role='TRANSPORTER' and not exists(
    select 1 from public.organization_members member
    where member.user_id=actor_user_id and member.organization_id=actor.organization_id
      and member.membership_role='OWNER'
  ) then raise exception 'FORBIDDEN'; end if;
  select * into vehicle from public.vehicles item where item.id=target_vehicle_id and item.active for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if actor.actor_role='TRANSPORTER' and vehicle.organization_id is distinct from actor.organization_id
    or actor.actor_role='DRIVER' and vehicle.provider_profile_id is distinct from actor.provider_profile_id then
    raise exception 'FORBIDDEN';
  end if;
  if not vehicle.trailer_interchangeable then raise exception 'NOT_INTERCHANGEABLE_TRACTOR'; end if;
  if configuration_value<>all(vehicle.supported_trailer_configurations) then
    raise exception 'INCOMPATIBLE_TRAILER_CONFIGURATION';
  end if;
  previous_configuration:=vehicle.cargo_configuration;
  update public.vehicles set cargo_configuration=configuration_value,category='Tractor'
  where id=vehicle.id;
  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,actor.organization_id,'VEHICLE_ATTACHED_TRAILER_CHANGED','vehicle',vehicle.id,
    jsonb_build_object('previousConfiguration',previous_configuration,'cargoConfiguration',configuration_value),now());
  return jsonb_build_object('id',vehicle.id,'cargo_configuration',configuration_value,
    'trailer_interchangeable',true,'supported_trailer_configurations',vehicle.supported_trailer_configurations);
end;
$$;

revoke all on function public.create_provider_vehicle(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.set_provider_vehicle_attached_trailer(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_provider_vehicle(uuid,jsonb) to service_role;
grant execute on function public.set_provider_vehicle_attached_trailer(uuid,jsonb) to service_role;

comment on function public.create_provider_vehicle(uuid,jsonb) is
  'Registers one provider vehicle and validates fixed or interchangeable-trailer configuration.';
comment on function public.set_provider_vehicle_attached_trailer(uuid,jsonb) is
  'Changes only an owned interchangeable tractor current trailer while preserving the vehicle identity.';
