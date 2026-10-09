-- FEAT-APP/FLT/IAM/VER/MOB: preserve Auth IDs, signup and operating history.
-- Refuse ambiguous existing data. Do not select/delete a customer's current truck.
do $$ begin
 if exists(select 1 from public.vehicles where active and provider_profile_id is not null
   group by provider_profile_id having count(*)>1) then raise exception 'INDEPENDENT_MULTIPLE_CURRENT_TRUCKS';end if;
end $$;
alter table public.vehicles add column use_basis text check(use_basis in ('OWNED','PERMISSION'));
create unique index one_independent_active_vehicle on public.vehicles(provider_profile_id)
 where active and provider_profile_id is not null;
alter table public.platform_controls add column independent_single_truck boolean not null default true check(independent_single_truck);

-- Patch exact existing command contracts; preserve signatures, permissions,
-- trailer validations, private boundaries and lifecycle/audit behavior.
do $migration$
declare definition text;replacement text;anchor text;
begin
 definition:=pg_get_functiondef('public.create_provider_vehicle(uuid,jsonb)'::regprocedure);
 anchor:=E'  actor record;';
 replacement:=replace(definition,anchor,anchor||E'\n  current_vehicle_id uuid; requested_replacement uuid; use_basis_value text;');
 if replacement=definition then raise exception 'SINGLE_TRUCK_CREATE_DECLARATION_MISSING';end if;
 definition:=replacement;
 anchor:=E'  if char_length(make_value) not between 2 and 60 then';
 replacement:=replace(definition,anchor,$body$
  use_basis_value:=nullif(command->>'use_basis','');
  if use_basis_value is not null and use_basis_value not in ('OWNED','PERMISSION') then raise exception 'INVALID_VEHICLE_USE_BASIS';end if;
  if actor.actor_role='DRIVER' then
    -- Serialize initial additions and replacements for this exact provider.
    perform 1 from public.provider_profiles where id=actor.provider_profile_id and user_id=actor_user_id for update;
    if not found then raise exception 'FORBIDDEN';end if;
    if use_basis_value is null then raise exception 'INVALID_VEHICLE_USE_BASIS';end if;
    begin requested_replacement:=nullif(command->>'replace_vehicle_id','')::uuid;
    exception when others then raise exception 'NOT_FOUND';end;
    select id into current_vehicle_id from public.vehicles where provider_profile_id=actor.provider_profile_id and active for update;
    if requested_replacement is null then
      if current_vehicle_id is not null then raise exception 'SINGLE_TRUCK_LIMIT';end if;
    else
      if current_vehicle_id is distinct from requested_replacement then raise exception 'TRUCK_CHANGED';end if;
      if command->>'replacement_confirmed' is distinct from 'true' then raise exception 'TRUCK_CHANGE_CONFIRMATION_REQUIRED';end if;
      -- Raises on unfinished Tracking; all later validation errors roll back this retirement.
      perform public.set_vehicle_lifecycle(actor_user_id,current_vehicle_id,false,'Changed the truck I drive');
    end if;
  elsif nullif(command->>'replace_vehicle_id','') is not null then
    raise exception 'FORBIDDEN';
  end if;
  if char_length(make_value) not between 2 and 60 then$body$);
 if replacement=definition then raise exception 'SINGLE_TRUCK_CREATE_GUARD_MISSING';end if;
 definition:=replacement;
 anchor:='platform_number,active,trailer_interchangeable,supported_trailer_configurations';
 replacement:=replace(definition,anchor,anchor||',use_basis');
 if replacement=definition then raise exception 'SINGLE_TRUCK_CREATE_COLUMNS_MISSING';end if;
 definition:=replacement;
 anchor:='configuration_value,plate_value,platform_number_value,true,interchangeable_value,supported_value';
 replacement:=replace(definition,anchor,anchor||',use_basis_value');
 if replacement=definition then raise exception 'SINGLE_TRUCK_CREATE_VALUES_MISSING';end if;
 execute replacement;

 definition:=pg_get_functiondef('public.update_provider_vehicle_details(uuid,jsonb)'::regprocedure);
 anchor:='  if char_length(make_value) not between 2 and 60 then';
 replacement:=replace(definition,anchor,$body$
  if actor.actor_role='DRIVER' then
    if nullif(command->>'use_basis','') is null or command->>'use_basis' not in ('OWNED','PERMISSION') then raise exception 'INVALID_VEHICLE_USE_BASIS';end if;
    if make_value is distinct from vehicle.make or model_value is distinct from vehicle.model
      or plate_value is distinct from vehicle.plate or (not vehicle.trailer_interchangeable and config is distinct from vehicle.cargo_configuration)
      then raise exception 'TRUCK_CHANGE_REQUIRED';end if;
  end if;
  if char_length(make_value) not between 2 and 60 then$body$);
 if replacement=definition then raise exception 'SINGLE_TRUCK_EDIT_GUARD_MISSING';end if;
 definition:=replacement;
 anchor:='  insert into audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)';
 replacement:=replace(definition,anchor,E'  if actor.actor_role=''DRIVER'' then update public.vehicles set use_basis=command->>''use_basis'' where id=vehicle.id;end if;\n'||anchor);
 if replacement=definition then raise exception 'SINGLE_TRUCK_USE_BASIS_WRITE_MISSING';end if;
 execute replacement;

 definition:=pg_get_functiondef('public.set_vehicle_lifecycle(uuid,uuid,boolean,text)'::regprocedure);
 anchor:=' if vehicle.active=desired_active then';
 replacement:=replace(definition,anchor,$body$
 if desired_active and vehicle.provider_profile_id is not null and not vehicle.active then
   if exists(select 1 from public.profiles where id=actor_user_id and role='DRIVER') then raise exception 'TRUCK_CHANGE_REQUIRED';end if;
   if exists(select 1 from public.vehicles where provider_profile_id=vehicle.provider_profile_id and active and id<>vehicle.id) then raise exception 'SINGLE_TRUCK_LIMIT';end if;
 end if;
 if vehicle.active=desired_active then$body$);
 if replacement=definition then raise exception 'SINGLE_TRUCK_RESTORE_GUARD_MISSING';end if;
 execute replacement;

 -- Normalize new intents and the current identity projection; historical
 -- application/audit rows and unexpired old intents remain valid and unchanged.
 definition:=pg_get_functiondef('public.prepare_provider_signup_intent(text,text,text,text,text,text,timestamptz)'::regprocedure);
 anchor:='  if clean_type not in';
 replacement:=replace(definition,anchor,E'  if clean_type=''OWNER_OPERATOR'' then clean_type:=''SELF_MANAGED_DRIVER'';end if;\n'||anchor);
 if replacement=definition then raise exception 'INDEPENDENT_SIGNUP_ALIAS_CONTRACT_MISSING';end if;
 execute replacement;
 definition:=pg_get_functiondef('public.current_user_projection()'::regprocedure);
 replacement:=replace(definition,') then ''OWNER_OPERATOR''',') then ''SELF_MANAGED_DRIVER''');
 if replacement=definition then raise exception 'INDEPENDENT_IDENTITY_PROJECTION_MISSING';end if;
 execute replacement;
end $migration$;

-- No new definer function, relation, browser RPC or table grant is introduced.
comment on column public.vehicles.use_basis is 'Provider-declared OWNED/PERMISSION; not proof or document verification. Legacy unknown remains null.';
notify pgrst,'reload schema';
