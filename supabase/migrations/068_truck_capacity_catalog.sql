-- FEAT-FLT-001 / FEAT-DAT-001
-- Keep registration aligned with the active truck-capacity catalogue. Courier
-- cars and motorcycles are deliberately retired rather than retained as
-- aliases because this pre-customer project has no production records to
-- preserve.

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
  platform_number_value text;
begin
  if command is null or jsonb_typeof(command)<>'object' then raise exception 'INVALID_VEHICLE_INPUT'; end if;
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
    'Cargo van','Pickup truck','Pickup stake body',
    'Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck',
    'Light Stake Body Truck','Light Box Truck','Medium Stake Body Truck','Medium Box Truck',
    'Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer'
  ]::text[]) then raise exception 'INVALID_VEHICLE_CONFIGURATION'; end if;

  platform_number_value:='LG-TRK-'||upper(substr(replace(vehicle_id::text,'-',''),1,10));
  insert into public.vehicles(
    id,organization_id,provider_profile_id,label,category,make,model,cargo_configuration,plate,platform_number,active
  ) values (
    vehicle_id,actor.organization_id,actor.provider_profile_id,
    concat_ws(' ',make_value,model_value),configuration_value,make_value,model_value,
    configuration_value,plate_value,platform_number_value,true
  );
  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,actor.organization_id,'PROVIDER_VEHICLE_CREATED','vehicle',vehicle_id,
    jsonb_build_object('platformNumber',platform_number_value,'cargoConfiguration',configuration_value),now());
  return jsonb_build_object(
    'id',vehicle_id,'platform_number',platform_number_value,'make',make_value,'model',model_value,
    'cargo_configuration',configuration_value,'active',true
  );
end;
$$;

revoke all on function public.create_provider_vehicle(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_provider_vehicle(uuid,jsonb) to service_role;

comment on function public.create_provider_vehicle(uuid,jsonb) is
  'Atomically registers one provider-owned truck using the active freight-capacity configuration catalogue.';
