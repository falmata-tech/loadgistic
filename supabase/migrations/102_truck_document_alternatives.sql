-- FEAT-VER-001: document-specific truck ownership or use permission.
-- Additive commands only; preserve every existing request, private file and audit.
create or replace function public.managed_verification_controls_truck(actor_user_id uuid,target_vehicle_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.provider_capacity_actor_scope(actor_user_id) scope
    join public.vehicles vehicle on vehicle.id=target_vehicle_id and vehicle.active
    where scope.workspace_access and (
      scope.actor_role='TRANSPORTER' and vehicle.organization_id=scope.organization_id
      or scope.provider_profile_id is not null and vehicle.provider_profile_id=scope.provider_profile_id
      or scope.is_company_driver and vehicle.organization_id=scope.organization_id and exists(
        select 1 from public.driver_vehicle_assignments assignment
        where assignment.vehicle_id=vehicle.id and assignment.driver_user_id=actor_user_id and assignment.active)
    )
  )
$$;

create or replace function public.managed_verification_center(actor_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  actor public.profiles%rowtype;
  scope record;
  application_type text;
  subjects jsonb:='[]'::jsonb;
  vehicles jsonb:='[]'::jsonb;
  approved jsonb:='[]'::jsonb;
  row_record record;
  requests jsonb;
begin
  select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active;
  if not found or actor.role not in ('TRANSPORTER','DRIVER') then raise exception 'FORBIDDEN'; end if;
  select * into scope from public.provider_capacity_actor_scope(actor_user_id);
  if not found then raise exception 'FORBIDDEN'; end if;
  if not scope.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;

  if scope.actor_role='TRANSPORTER' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'verification_type',request.verification_type,'reviewed_at',request.reviewed_at,
      'expires_on',request.expires_on,'related_vehicle_id',request.related_vehicle_id
    ) order by request.reviewed_at desc nulls last,request.submitted_at desc,request.id),'[]'::jsonb)
      into approved from public.verification_requests request
      where request.subject_type='ORGANIZATION' and request.subject_id=scope.organization_id and request.status='APPROVED';
    subjects:=subjects||jsonb_build_array(jsonb_build_object(
      'subject_type','ORGANIZATION','subject_id',scope.organization_id,
      'name',(select organization.name from public.organizations organization where organization.id=scope.organization_id),
      'type','Fleet transporter','verification_types',jsonb_build_array('IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS'),
      'vehicles','[]'::jsonb,'approved_documents',approved
    ));
    for row_record in
      select driver.user_id,driver.name from public.drivers driver
      join public.profiles profile on profile.id=driver.user_id
      where driver.organization_id=scope.organization_id and driver.active and profile.active and profile.role='DRIVER'
      order by driver.name,driver.user_id
    loop
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',vehicle.id,'label',concat_ws(' · ',nullif(trim(concat_ws(' ',vehicle.make,vehicle.model)),''),vehicle.platform_number)
      ) order by vehicle.label,vehicle.id),'[]'::jsonb) into vehicles
      from public.driver_vehicle_assignments assignment join public.vehicles vehicle on vehicle.id=assignment.vehicle_id
      where assignment.driver_user_id=row_record.user_id and assignment.active and vehicle.active;
      select coalesce(jsonb_agg(jsonb_build_object(
        'verification_type',request.verification_type,'reviewed_at',request.reviewed_at,
        'expires_on',request.expires_on,'related_vehicle_id',request.related_vehicle_id
      ) order by request.reviewed_at desc nulls last,request.submitted_at desc,request.id),'[]'::jsonb)
        into approved from public.verification_requests request
        where request.subject_type='DRIVER' and request.subject_id=row_record.user_id and request.status='APPROVED';
      subjects:=subjects||jsonb_build_array(jsonb_build_object(
        'subject_type','DRIVER','subject_id',row_record.user_id,'name',row_record.name,
        'type','Company driver','verification_types',jsonb_build_array('IDENTITY','DRIVER_IDENTITY'),
        'vehicles',vehicles,'approved_documents',approved
      ));
    end loop;
  elsif scope.is_company_driver then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',vehicle.id,'label',concat_ws(' · ',nullif(trim(concat_ws(' ',vehicle.make,vehicle.model)),''),vehicle.platform_number)
    ) order by vehicle.label,vehicle.id),'[]'::jsonb) into vehicles
    from public.driver_vehicle_assignments assignment join public.vehicles vehicle on vehicle.id=assignment.vehicle_id
    where assignment.driver_user_id=actor_user_id and assignment.active and vehicle.active;
    select coalesce(jsonb_agg(jsonb_build_object(
      'verification_type',request.verification_type,'reviewed_at',request.reviewed_at,
      'expires_on',request.expires_on,'related_vehicle_id',request.related_vehicle_id
    ) order by request.reviewed_at desc nulls last,request.submitted_at desc,request.id),'[]'::jsonb)
      into approved from public.verification_requests request
      where request.subject_type='DRIVER' and request.subject_id=actor_user_id and request.status='APPROVED';
    subjects:=jsonb_build_array(jsonb_build_object(
      'subject_type','DRIVER','subject_id',actor_user_id,
      'name',coalesce((select driver.name from public.drivers driver where driver.user_id=actor_user_id),actor.full_name),
      'type',concat('Company driver · ',coalesce((select organization.name from public.organizations organization where organization.id=scope.organization_id),'Fleet transporter')),
      'verification_types',jsonb_build_array('IDENTITY','DRIVER_IDENTITY'),
      'vehicles',vehicles,'approved_documents',approved
    ));
  else
    select application.application_type into application_type
    from public.applications application where application.user_id=actor_user_id and application.status='APPROVED'
    order by application.created_at desc,application.id limit 1;
    application_type:=coalesce(application_type,'SELF_MANAGED_DRIVER');
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',vehicle.id,'label',concat_ws(' · ',nullif(trim(concat_ws(' ',vehicle.make,vehicle.model)),''),vehicle.platform_number)
    ) order by vehicle.label,vehicle.id),'[]'::jsonb) into vehicles
    from public.vehicles vehicle where vehicle.provider_profile_id=scope.provider_profile_id and vehicle.active;
    select coalesce(jsonb_agg(jsonb_build_object(
      'verification_type',request.verification_type,'reviewed_at',request.reviewed_at,
      'expires_on',request.expires_on,'related_vehicle_id',request.related_vehicle_id
    ) order by request.reviewed_at desc nulls last,request.submitted_at desc,request.id),'[]'::jsonb)
      into approved from public.verification_requests request
      where request.subject_type='PROVIDER_PROFILE' and request.subject_id=scope.provider_profile_id and request.status='APPROVED';
    subjects:=jsonb_build_array(jsonb_build_object(
      'subject_type','PROVIDER_PROFILE','subject_id',scope.provider_profile_id,
      'name',(select provider.business_name from public.provider_profiles provider where provider.id=scope.provider_profile_id),
      'type',case when application_type='OWNER_OPERATOR' then 'Owner-operator' else 'Self-managed driver' end,
      'verification_types',jsonb_build_array('IDENTITY','DRIVER_IDENTITY'),
      'vehicles',vehicles,'approved_documents',approved
    ));

  end if;

  -- Both evidence alternatives belong to a concrete current truck, regardless
  -- of the provider's signup model. Historical Driver pairings remain scoped.
  for row_record in
    select vehicle.id,vehicle.provider_profile_id,
      concat_ws(' · ',nullif(trim(concat_ws(' ',vehicle.make,vehicle.model)),''),vehicle.platform_number) as label
    from public.vehicles vehicle
    where public.managed_verification_controls_truck(actor_user_id,vehicle.id)
    order by vehicle.label,vehicle.id
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'verification_type',request.verification_type,'reviewed_at',request.reviewed_at,
      'expires_on',request.expires_on,'related_vehicle_id',request.related_vehicle_id
    ) order by (request.expires_on is null or request.expires_on >= (now() at time zone 'Africa/Addis_Ababa')::date) desc,
      request.reviewed_at desc nulls last,request.submitted_at desc,request.id),'[]'::jsonb)
    into approved from public.verification_requests request
    where request.status='APPROVED' and (
      request.subject_type='VEHICLE' and request.subject_id=row_record.id
      or request.verification_type='VEHICLE_AUTHORIZATION' and request.related_vehicle_id=row_record.id and (
        request.subject_type='PROVIDER_PROFILE' and request.subject_id=row_record.provider_profile_id
        or request.subject_type='DRIVER' and exists(select 1 from public.driver_vehicle_assignments assignment
          where assignment.vehicle_id=row_record.id and assignment.driver_user_id=request.subject_id and assignment.active)
      )
    );
    subjects:=subjects||jsonb_build_array(jsonb_build_object(
      'subject_type','VEHICLE','subject_id',row_record.id,'name',row_record.label,'type','Truck',
      'verification_types',jsonb_build_array('VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION'),
      'vehicles','[]'::jsonb,'approved_documents',approved
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',request.id,'subject_type',request.subject_type,'subject_id',request.subject_id,
    'verification_type',request.verification_type,'related_vehicle_id',request.related_vehicle_id,
    'expires_on',request.expires_on,'document_name',request.document_name,
    'original_name',request.original_name,'mime_type',request.mime_type,
    'status',request.status,'review_note',request.review_note,'submitted_at',request.submitted_at,
    'reviewed_at',request.reviewed_at,'reviewer_name',reviewer.full_name,'has_file',true
  ) order by request.submitted_at desc,request.id),'[]'::jsonb) into requests
  from public.verification_requests request
  left join public.profiles reviewer on reviewer.id=request.reviewed_by
  where request.submitted_by=actor_user_id;

  return jsonb_build_object('subjects',subjects,'requests',requests);
end;
$$;

create or replace function public.submit_managed_verification(actor_user_id uuid,command jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
#variable_conflict use_variable
declare
  scope record;
  subject_type text:=upper(trim(coalesce(command->>'subject_type','')));
  verification_type text:=upper(trim(coalesce(command->>'verification_type','')));
  subject_id uuid;
  related_vehicle_id uuid;
  expires_on date;
  document_name text:=trim(coalesce(command->>'document_name',''));
  storage_path text:=trim(coalesce(command->>'storage_path',''));
  original_name text:=left(trim(coalesce(command->>'original_name','')),160);
  mime_type text:=lower(trim(coalesce(command->>'mime_type','')));
  application_type text;
  request_id uuid:=gen_random_uuid();
begin
  if command is null or jsonb_typeof(command)<>'object' then raise exception 'INVALID_VERIFICATION_TYPE'; end if;
  begin subject_id:=(command->>'subject_id')::uuid; exception when others then raise exception 'FORBIDDEN'; end;
  begin related_vehicle_id:=nullif(trim(coalesce(command->>'related_vehicle_id','')),'')::uuid; exception when others then raise exception 'FORBIDDEN'; end;
  begin expires_on:=nullif(trim(coalesce(command->>'expires_on','')),'')::date; exception when others then raise exception 'TRUCK_AUTHORIZATION_DETAILS_REQUIRED'; end;
  select * into scope from public.provider_capacity_actor_scope(actor_user_id);
  if not found then raise exception 'FORBIDDEN'; end if;
  if not scope.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;
  if char_length(document_name)<1 or char_length(document_name)>160 or storage_path!~'^supabase://verification/verification/'
    or original_name='' or mime_type not in ('image/jpeg','image/png','image/webp','application/pdf') then
    raise exception 'VERIFICATION_DOCUMENT_REQUIRED';
  end if;
  if not (
    subject_type='ORGANIZATION' and verification_type in ('IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS')
    or subject_type='PROVIDER_PROFILE' and verification_type in ('IDENTITY','DRIVER_IDENTITY','VEHICLE_AUTHORIZATION')
    or subject_type='DRIVER' and verification_type in ('IDENTITY','DRIVER_IDENTITY','VEHICLE_AUTHORIZATION')
    or subject_type='VEHICLE' and verification_type in ('VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION')
  ) then raise exception 'INVALID_VERIFICATION_TYPE'; end if;
  if subject_type='ORGANIZATION' and not(scope.actor_role='TRANSPORTER' and scope.organization_id=subject_id)
    or subject_type='PROVIDER_PROFILE' and scope.provider_profile_id is distinct from subject_id
    or subject_type='DRIVER' and not(
      scope.is_company_driver and subject_id=actor_user_id
      or scope.actor_role='TRANSPORTER' and exists(select 1 from public.drivers driver where driver.user_id=subject_id and driver.organization_id=scope.organization_id and driver.active)
    )
    or subject_type='VEHICLE' and not public.managed_verification_controls_truck(actor_user_id,subject_id)
  then raise exception 'FORBIDDEN'; end if;

  if verification_type='VEHICLE_AUTHORIZATION' then
    if subject_type='VEHICLE' then
      if related_vehicle_id is not null and related_vehicle_id<>subject_id then raise exception 'FORBIDDEN'; end if;
      related_vehicle_id:=subject_id;
    end if;
    if related_vehicle_id is null or expires_on is null or expires_on<=current_date then raise exception 'TRUCK_AUTHORIZATION_DETAILS_REQUIRED'; end if;
    if subject_type='PROVIDER_PROFILE' and not exists(select 1 from public.vehicles vehicle where vehicle.id=related_vehicle_id and vehicle.provider_profile_id=subject_id and vehicle.active)
      or subject_type='DRIVER' and not exists(select 1 from public.driver_vehicle_assignments assignment join public.vehicles vehicle on vehicle.id=assignment.vehicle_id
        where assignment.driver_user_id=subject_id and assignment.vehicle_id=related_vehicle_id and assignment.active and vehicle.active)
    then raise exception 'FORBIDDEN'; end if;
  else
    related_vehicle_id:=null;expires_on:=null;
  end if;
  -- A Driver's permission remains personal after truck reassignment. The UI
  -- selects the truck; the durable subject retains the actual grantee.
  if subject_type='VEHICLE' and verification_type='VEHICLE_AUTHORIZATION' and scope.is_company_driver then
    subject_type:='DRIVER';subject_id:=actor_user_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('verification:'||subject_type||':'||subject_id::text,0));
  if exists(select 1 from public.verification_requests request
    where request.subject_type::text=subject_type and request.subject_id=subject_id
      and request.verification_type::text=verification_type
      and request.related_vehicle_id is not distinct from related_vehicle_id
      and request.status in ('PENDING','APPROVED') and (request.expires_on is null or request.expires_on>=current_date)
  ) then raise exception 'VERIFICATION_ALREADY_SUBMITTED'; end if;

  insert into public.verification_requests(id,subject_type,subject_id,verification_type,related_vehicle_id,expires_on,
    document_name,storage_path,original_name,mime_type,status,submitted_by,submitted_at)
  values(request_id,subject_type::public.verification_subject_type,subject_id,verification_type::public.verification_type,
    related_vehicle_id,expires_on,document_name,storage_path,original_name,mime_type,'PENDING',actor_user_id,now());
  insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
  values(actor_user_id,scope.organization_id,'VERIFICATION_SUBMITTED','verification_request',request_id,
    jsonb_build_object('subject_type',subject_type,'subject_id',subject_id,'verification_type',verification_type,
      'related_vehicle_id',related_vehicle_id,'expires_on',expires_on));
  return request_id;
end;
$$;

revoke all on function public.managed_verification_controls_truck(uuid,uuid) from public,anon,authenticated;
grant execute on function public.managed_verification_controls_truck(uuid,uuid) to service_role;
revoke all on function public.managed_verification_center(uuid) from public,anon,authenticated;
grant execute on function public.managed_verification_center(uuid) to service_role;
revoke all on function public.submit_managed_verification(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.submit_managed_verification(uuid,jsonb) to service_role;

-- Called only by the server after public/private capacity visibility has been
-- checked. Return bounded badge metadata, never document names or file paths.
create or replace function public.capacity_owner_documents(organization_ids uuid[],provider_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if coalesce(cardinality(organization_ids),0)+coalesce(cardinality(provider_ids),0)>100 then
    raise exception 'INVALID_PAGE_SIZE';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('subject_type',owner.subject_type,'subject_id',owner.subject_id,
    'documents',coalesce(documents.records,'[]'::jsonb))),'[]'::jsonb) into result
  from (
    select 'ORGANIZATION' as subject_type,id as subject_id from unnest(organization_ids) id
    union select 'PROVIDER_PROFILE',id from unnest(provider_ids) id
  ) owner
  cross join lateral (
    select jsonb_agg(jsonb_build_object('verification_type',latest.verification_type,
      'reviewed_at',latest.reviewed_at,'expires_on',latest.expires_on)) as records
    from (
      select distinct on (request.verification_type) request.verification_type,request.reviewed_at,request.expires_on
      from public.verification_requests request
      where request.subject_type::text=owner.subject_type and request.subject_id=owner.subject_id and request.status='APPROVED'
        and (owner.subject_type='ORGANIZATION' and request.verification_type in ('IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS')
          or owner.subject_type='PROVIDER_PROFILE' and request.verification_type in ('IDENTITY','DRIVER_IDENTITY'))
      order by request.verification_type,
        (request.expires_on is null or request.expires_on >= (now() at time zone 'Africa/Addis_Ababa')::date) desc,
        request.reviewed_at desc nulls last,request.id
    ) latest
  ) documents;
  return result;
end;
$$;
revoke all on function public.capacity_owner_documents(uuid[],uuid[]) from public,anon,authenticated;
grant execute on function public.capacity_owner_documents(uuid[],uuid[]) to service_role;
