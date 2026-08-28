-- BASE-BE-001 / FEAT-VER-001 / FEAT-BIL-001
-- Server-only Verification and Billing ports. HTTP adapters establish the
-- actor; PostgreSQL repeats workspace, permission, ownership, status, and
-- private-file authorization before returning a minimized projection.

create or replace function public.managed_actor_has_permission(actor_user_id uuid,permission_name text)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1
    from public.profiles profile
    left join public.support_agent_profiles support on support.user_id=profile.id
    where profile.id=actor_user_id and profile.active and (
      profile.role='ADMIN'
      or profile.role='SUPPORT' and support.active and case upper(permission_name)
        when 'TRUST' then support.can_manage_trust
        when 'BILLING' then support.can_manage_billing
        else false
      end
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
        'type','Company driver','verification_types',jsonb_build_array('IDENTITY','DRIVER_IDENTITY','VEHICLE_AUTHORIZATION'),
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
      'verification_types',jsonb_build_array('IDENTITY','DRIVER_IDENTITY','VEHICLE_AUTHORIZATION'),
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
      'verification_types',case when application_type='OWNER_OPERATOR'
        then jsonb_build_array('IDENTITY','DRIVER_IDENTITY')
        else jsonb_build_array('IDENTITY','DRIVER_IDENTITY','VEHICLE_AUTHORIZATION') end,
      'vehicles',vehicles,'approved_documents',approved
    ));
    if application_type='OWNER_OPERATOR' then
      for row_record in select vehicle.id,concat_ws(' · ',nullif(trim(concat_ws(' ',vehicle.make,vehicle.model)),''),vehicle.platform_number) as label
        from public.vehicles vehicle where vehicle.provider_profile_id=scope.provider_profile_id and vehicle.active order by vehicle.label,vehicle.id
      loop
        select coalesce(jsonb_agg(jsonb_build_object(
          'verification_type',request.verification_type,'reviewed_at',request.reviewed_at,
          'expires_on',request.expires_on,'related_vehicle_id',request.related_vehicle_id
        ) order by request.reviewed_at desc nulls last,request.submitted_at desc,request.id),'[]'::jsonb)
          into approved from public.verification_requests request
          where request.subject_type='VEHICLE' and request.subject_id=row_record.id and request.status='APPROVED';
        subjects:=subjects||jsonb_build_array(jsonb_build_object(
          'subject_type','VEHICLE','subject_id',row_record.id,'name',row_record.label,'type','Truck ownership',
          'verification_types',jsonb_build_array('VEHICLE_OWNERSHIP'),'vehicles','[]'::jsonb,'approved_documents',approved
        ));
      end loop;
    end if;
  end if;

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
    or subject_type='VEHICLE' and verification_type='VEHICLE_OWNERSHIP'
  ) then raise exception 'INVALID_VERIFICATION_TYPE'; end if;
  if subject_type='ORGANIZATION' and not(scope.actor_role='TRANSPORTER' and scope.organization_id=subject_id)
    or subject_type='PROVIDER_PROFILE' and scope.provider_profile_id is distinct from subject_id
    or subject_type='DRIVER' and not(
      scope.is_company_driver and subject_id=actor_user_id
      or scope.actor_role='TRANSPORTER' and exists(select 1 from public.drivers driver where driver.user_id=subject_id and driver.organization_id=scope.organization_id and driver.active)
    )
    or subject_type='VEHICLE' and not exists(select 1 from public.vehicles vehicle where vehicle.id=subject_id and vehicle.provider_profile_id=scope.provider_profile_id and vehicle.active)
  then raise exception 'FORBIDDEN'; end if;

  if scope.provider_profile_id is not null then
    select application.application_type into application_type from public.applications application
    where application.user_id=actor_user_id and application.status='APPROVED'
    order by application.created_at desc,application.id limit 1;
    if verification_type='VEHICLE_OWNERSHIP' and coalesce(application_type,'SELF_MANAGED_DRIVER')<>'OWNER_OPERATOR'
      or verification_type='VEHICLE_AUTHORIZATION' and coalesce(application_type,'SELF_MANAGED_DRIVER')='OWNER_OPERATOR'
    then raise exception 'INVALID_VERIFICATION_TYPE'; end if;
  end if;
  if verification_type='VEHICLE_AUTHORIZATION' then
    if related_vehicle_id is null or expires_on is null or expires_on<=current_date then raise exception 'TRUCK_AUTHORIZATION_DETAILS_REQUIRED'; end if;
    if subject_type='PROVIDER_PROFILE' and not exists(select 1 from public.vehicles vehicle where vehicle.id=related_vehicle_id and vehicle.provider_profile_id=subject_id and vehicle.active)
      or subject_type='DRIVER' and not exists(select 1 from public.driver_vehicle_assignments assignment join public.vehicles vehicle on vehicle.id=assignment.vehicle_id
        where assignment.driver_user_id=subject_id and assignment.vehicle_id=related_vehicle_id and assignment.active and vehicle.active)
    then raise exception 'FORBIDDEN'; end if;
  else
    related_vehicle_id:=null;expires_on:=null;
  end if;
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

create or replace function public.managed_verification_file(actor_user_id uuid,request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare request_record public.verification_requests%rowtype;
begin
  select * into request_record from public.verification_requests request where request.id=request_id;
  if not found then return null; end if;
  if request_record.submitted_by<>actor_user_id and not public.managed_actor_has_permission(actor_user_id,'TRUST') then return null; end if;
  return jsonb_build_object('storage_path',request_record.storage_path,'original_name',request_record.original_name,'mime_type',request_record.mime_type);
end;
$$;

create or replace function public.managed_verification_review_page(actor_user_id uuid,requested_status text default 'ALL',search_text text default '',requested_offset integer default 0,requested_limit integer default 12)
returns table(payload jsonb,total_count bigint)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if not public.managed_actor_has_permission(actor_user_id,'TRUST') then raise exception 'FORBIDDEN'; end if;
  return query with scoped as (
    select request.*,submitter.full_name as submitter_name,reviewer.full_name as reviewer_name
    from public.verification_requests request join public.profiles submitter on submitter.id=request.submitted_by
    left join public.profiles reviewer on reviewer.id=request.reviewed_by
    where (upper(coalesce(requested_status,'ALL'))='ALL' or request.status::text=upper(requested_status))
      and (trim(coalesce(search_text,''))='' or concat_ws(' ',submitter.full_name,request.document_name,request.original_name,request.subject_type::text,request.verification_type::text,request.status::text) ilike '%'||trim(search_text)||'%')
  ), counted as (select scoped.*,count(*) over() as row_total from scoped)
  select jsonb_build_object('id',row.id,'subject_type',row.subject_type,'subject_id',row.subject_id,
    'verification_type',row.verification_type,'related_vehicle_id',row.related_vehicle_id,'expires_on',row.expires_on,
    'document_name',row.document_name,'original_name',row.original_name,'mime_type',row.mime_type,'has_file',true,
    'status',row.status,'submitter_name',row.submitter_name,'reviewer_name',row.reviewer_name,
    'review_note',row.review_note,'submitted_at',row.submitted_at,'reviewed_at',row.reviewed_at),row.row_total
  from counted row order by case row.status when 'PENDING' then 0 when 'MORE_INFO' then 1 else 2 end,row.submitted_at desc,row.id
  offset greatest(0,coalesce(requested_offset,0)) limit greatest(1,least(50,coalesce(requested_limit,12)));
end;
$$;

create or replace function public.review_managed_verification(actor_user_id uuid,request_id uuid,review_status text,review_note text default '')
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare request_record public.verification_requests%rowtype;clean_status text:=upper(trim(coalesce(review_status,'')));
begin
  if not public.managed_actor_has_permission(actor_user_id,'TRUST') then raise exception 'FORBIDDEN'; end if;
  if clean_status not in ('APPROVED','REJECTED','MORE_INFO') then raise exception 'INVALID_STATUS'; end if;
  select * into request_record from public.verification_requests request where request.id=request_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if request_record.status in ('APPROVED','REJECTED') then raise exception 'VERIFICATION_ALREADY_REVIEWED'; end if;
  update public.verification_requests set status=clean_status::public.verification_status,reviewed_by=actor_user_id,
    review_note=nullif(left(trim(coalesce(review_note,'')),500),''),reviewed_at=now() where id=request_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
  values(actor_user_id,'VERIFICATION_REVIEWED','verification_request',request_id,
    jsonb_build_object('status',clean_status,'subject_type',request_record.subject_type,
      'subject_id',request_record.subject_id,'verification_type',request_record.verification_type));
end;
$$;

create or replace function public.managed_billing_summary(actor_user_id uuid,requested_offset integer default 0,requested_limit integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare subscription_record record;proofs jsonb;proof_total bigint;
begin
  if not exists(select 1 from public.profiles profile where profile.id=actor_user_id and profile.active) then raise exception 'FORBIDDEN'; end if;
  select subscription.*,plan.name as plan_name into subscription_record
  from public.subscriptions subscription join public.plans plan on plan.id=subscription.plan_id
  where subscription.organization_id in (select member.organization_id from public.organization_members member where member.user_id=actor_user_id)
    or subscription.provider_profile_id in (select provider.id from public.provider_profiles provider where provider.user_id=actor_user_id)
  order by subscription.updated_at desc,subscription.id limit 1;
  if not found then return jsonb_build_object('subscription',null,'proofs','[]'::jsonb,'proof_total',0); end if;
  select count(*) into proof_total from public.payment_proofs proof where proof.subscription_id=subscription_record.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',proof.id,'subscription_id',proof.subscription_id,
    'amount_minor',proof.amount_minor,'reference',proof.reference,'has_file',proof.file_path is not null,
    'status',proof.status,'submitted_at',proof.submitted_at,'reviewed_at',proof.reviewed_at)
    order by proof.submitted_at desc,proof.id),'[]'::jsonb) into proofs
  from (select * from public.payment_proofs proof where proof.subscription_id=subscription_record.id
    order by proof.submitted_at desc,proof.id offset greatest(0,coalesce(requested_offset,0))
    limit greatest(1,least(50,coalesce(requested_limit,10)))) proof;
  return jsonb_build_object('subscription',to_jsonb(subscription_record),'proofs',proofs,'proof_total',proof_total);
end;
$$;

create or replace function public.submit_managed_payment_proof(actor_user_id uuid,command jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare subscription_record public.subscriptions%rowtype;amount_minor bigint;proof_id uuid:=gen_random_uuid();storage_path text;original_name text;mime_type text;reference text;
begin
  if command is null or jsonb_typeof(command)<>'object' then raise exception 'INVALID_ETB_AMOUNT'; end if;
  begin amount_minor:=(command->>'amount_minor')::bigint; exception when others then raise exception 'INVALID_ETB_AMOUNT'; end;
  if amount_minor<=0 then raise exception 'INVALID_ETB_AMOUNT'; end if;
  reference:=nullif(left(trim(coalesce(command->>'reference','')),160),'');
  storage_path:=nullif(trim(coalesce(command->>'storage_path','')),'');
  original_name:=nullif(left(trim(coalesce(command->>'original_name','')),160),'');
  mime_type:=nullif(lower(trim(coalesce(command->>'mime_type',''))),'');
  if storage_path is not null and (storage_path!~'^supabase://payment-proof/payment/' or original_name is null
    or mime_type not in ('image/jpeg','image/png','image/webp','application/pdf')) then raise exception 'INVALID_PRIVATE_STORAGE_REFERENCE'; end if;
  select subscription.* into subscription_record from public.subscriptions subscription
  where subscription.organization_id in (select member.organization_id from public.organization_members member where member.user_id=actor_user_id)
    or subscription.provider_profile_id in (select provider.id from public.provider_profiles provider where provider.user_id=actor_user_id)
  order by subscription.updated_at desc,subscription.id limit 1 for update;
  if not found then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  if subscription_record.status='SPONSORED' then raise exception 'PAYMENT_NOT_REQUIRED'; end if;
  insert into public.payment_proofs(id,subscription_id,amount_minor,reference,file_path,original_name,mime_type,status,submitted_at)
  values(proof_id,subscription_record.id,amount_minor,reference,storage_path,original_name,mime_type,'PENDING',now());
  if not(subscription_record.status in ('TRIAL','ACTIVE') and subscription_record.ends_at>now()) then
    update public.subscriptions set status='PAYMENT_UNDER_REVIEW',updated_at=now() where id=subscription_record.id;
  end if;
  insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
  values(actor_user_id,subscription_record.organization_id,'PAYMENT_PROOF_SUBMITTED','payment_proof',proof_id,
    jsonb_build_object('amount_minor',amount_minor,'has_file',storage_path is not null));
  return proof_id;
end;
$$;

create or replace function public.managed_payment_proof_file(actor_user_id uuid,proof_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare proof_record record;
begin
  select proof.*,subscription.organization_id,subscription.provider_profile_id into proof_record
  from public.payment_proofs proof join public.subscriptions subscription on subscription.id=proof.subscription_id where proof.id=proof_id;
  if not found or proof_record.file_path is null then return null; end if;
  if not public.managed_actor_has_permission(actor_user_id,'BILLING') and not exists(
    select 1 from public.organization_members member where member.user_id=actor_user_id and member.organization_id=proof_record.organization_id
    union all select 1 from public.provider_profiles provider where provider.user_id=actor_user_id and provider.id=proof_record.provider_profile_id
  ) then return null; end if;
  return jsonb_build_object('storage_path',proof_record.file_path,'original_name',proof_record.original_name,'mime_type',proof_record.mime_type);
end;
$$;

create or replace function public.managed_payment_review_page(actor_user_id uuid,requested_status text default 'ALL',search_text text default '',requested_offset integer default 0,requested_limit integer default 12)
returns table(payload jsonb,total_count bigint)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if not public.managed_actor_has_permission(actor_user_id,'BILLING') then raise exception 'FORBIDDEN'; end if;
  return query with scoped as (
    select proof.*,plan.name as plan_name,organization.name as organization_name,provider.business_name as provider_name,
      subscription.status as subscription_status,subscription.ends_at as subscription_ends_at
    from public.payment_proofs proof join public.subscriptions subscription on subscription.id=proof.subscription_id
    join public.plans plan on plan.id=subscription.plan_id left join public.organizations organization on organization.id=subscription.organization_id
    left join public.provider_profiles provider on provider.id=subscription.provider_profile_id
    where (upper(coalesce(requested_status,'ALL'))='ALL' or proof.status=upper(requested_status))
      and (trim(coalesce(search_text,''))='' or concat_ws(' ',organization.name,provider.business_name,plan.name,proof.reference,proof.status) ilike '%'||trim(search_text)||'%')
  ), counted as (select scoped.*,count(*) over() as row_total from scoped)
  select jsonb_build_object('id',row.id,'subscription_id',row.subscription_id,'amount_minor',row.amount_minor,
    'reference',row.reference,'has_file',row.file_path is not null,'status',row.status,'submitted_at',row.submitted_at,
    'reviewed_at',row.reviewed_at,'plan_name',row.plan_name,'organization_name',row.organization_name,
    'provider_name',row.provider_name,'subscription_status',row.subscription_status,'subscription_ends_at',row.subscription_ends_at),row.row_total
  from counted row order by row.submitted_at desc,row.id
  offset greatest(0,coalesce(requested_offset,0)) limit greatest(1,least(50,coalesce(requested_limit,12)));
end;
$$;

create or replace function public.review_managed_payment_proof(actor_user_id uuid,proof_id uuid,review_status text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare proof_record public.payment_proofs%rowtype;subscription_record public.subscriptions%rowtype;clean_status text:=upper(trim(coalesce(review_status,'')));access_ends_at timestamptz;
begin
  if not public.managed_actor_has_permission(actor_user_id,'BILLING') then raise exception 'FORBIDDEN'; end if;
  if clean_status not in ('APPROVED','REJECTED','MORE_INFO') then raise exception 'INVALID_STATUS'; end if;
  select * into proof_record from public.payment_proofs proof where proof.id=proof_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if proof_record.status in ('APPROVED','REJECTED') then raise exception 'PAYMENT_PROOF_ALREADY_REVIEWED'; end if;
  select * into subscription_record from public.subscriptions subscription where subscription.id=proof_record.subscription_id for update;
  update public.payment_proofs set status=clean_status,reviewed_by=actor_user_id,reviewed_at=now() where id=proof_id;
  if clean_status='APPROVED' then
    access_ends_at:=now()+interval '30 days';
    update public.subscriptions set status='ACTIVE',billing_model='FLAT_MONTHLY',starts_at=now(),ends_at=access_ends_at,updated_at=now() where id=subscription_record.id;
  elsif not(subscription_record.status='SPONSORED' or subscription_record.status in ('TRIAL','ACTIVE') and subscription_record.ends_at>now()) then
    update public.subscriptions set status=case when clean_status='MORE_INFO' then 'PAYMENT_UNDER_REVIEW' else 'PAYMENT_REQUIRED' end,updated_at=now() where id=subscription_record.id;
  end if;
  insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
  values(actor_user_id,subscription_record.organization_id,'PAYMENT_PROOF_REVIEWED','payment_proof',proof_id,
    jsonb_build_object('status',clean_status,'access_ends_at',access_ends_at));
  return jsonb_build_object('status',clean_status,'access_ends_at',access_ends_at);
end;
$$;

revoke all on function public.managed_actor_has_permission(uuid,text) from public,anon,authenticated;
revoke all on function public.managed_verification_center(uuid) from public,anon,authenticated;
revoke all on function public.submit_managed_verification(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.managed_verification_file(uuid,uuid) from public,anon,authenticated;
revoke all on function public.managed_verification_review_page(uuid,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.review_managed_verification(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.managed_billing_summary(uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.submit_managed_payment_proof(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.managed_payment_proof_file(uuid,uuid) from public,anon,authenticated;
revoke all on function public.managed_payment_review_page(uuid,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.review_managed_payment_proof(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.managed_actor_has_permission(uuid,text) to service_role;
grant execute on function public.managed_verification_center(uuid) to service_role;
grant execute on function public.submit_managed_verification(uuid,jsonb) to service_role;
grant execute on function public.managed_verification_file(uuid,uuid) to service_role;
grant execute on function public.managed_verification_review_page(uuid,text,text,integer,integer) to service_role;
grant execute on function public.review_managed_verification(uuid,uuid,text,text) to service_role;
grant execute on function public.managed_billing_summary(uuid,integer,integer) to service_role;
grant execute on function public.submit_managed_payment_proof(uuid,jsonb) to service_role;
grant execute on function public.managed_payment_proof_file(uuid,uuid) to service_role;
grant execute on function public.managed_payment_review_page(uuid,text,text,integer,integer) to service_role;
grant execute on function public.review_managed_payment_proof(uuid,uuid,text) to service_role;
