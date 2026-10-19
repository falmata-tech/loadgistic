-- FEAT-GPS/IAM/PLY/SEC-001: stop collection on closure; verify upstream erasure
-- before deleting private local tracker data or reporting account completion.
begin;
select pg_advisory_xact_lock(8030154);
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.telematics_gateways add column privacy_token_digest text unique
 check(privacy_token_digest is null or privacy_token_digest~'^[a-f0-9]{64}$');
alter table public.telematics_gateways add constraint privacy_credential_separate
 check(privacy_token_digest is null or privacy_token_digest<>token_digest);

-- Global namespaces stay disjoint even when two administrators register
-- different gateways concurrently. The lock is shared by both token writes.
create function public.require_distinct_telematics_privacy_credentials()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(8030154001::bigint);
 if new.privacy_token_digest is not null and new.privacy_token_digest=new.token_digest
  or exists(select 1 from telematics_gateways g where g.id<>new.id and(
   g.privacy_token_digest=new.token_digest or new.privacy_token_digest is not null and g.token_digest=new.privacy_token_digest))
 then raise exception 'PRIVACY_GATEWAY_UNAVAILABLE';end if;
 return new;
end $$;
create trigger telematics_privacy_credentials_disjoint
 before insert or update of token_digest,privacy_token_digest on public.telematics_gateways
 for each row execute function public.require_distinct_telematics_privacy_credentials();
revoke all on function public.require_distinct_telematics_privacy_credentials() from public,anon,authenticated,service_role;

create table public.telematics_privacy_jobs(
 id uuid primary key default gen_random_uuid(),
 request_id uuid references public.account_deletion_requests(id) on delete cascade,
 subject_user_id uuid references public.profiles(id) on delete set null,
 device_id uuid not null,gateway_id uuid not null references public.telematics_gateways(id),
 purpose text not null check(purpose in('DISABLE','ERASE')),operation_key text not null,
 gateway_device_id bigint,imei text,protocol text not null,protocol_device_id text,
 device_fingerprint text not null check(device_fingerprint~'^[a-f0-9]{64}$'),
 binding_digest text not null check(binding_digest~'^[a-f0-9]{64}$'),
 state text not null default 'PENDING' check(state in('PENDING','LEASED','VERIFIED')),
 lease_id uuid,lease_until timestamptz,verified_at timestamptz,local_erased_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 check((purpose='ERASE')=(request_id is not null)),
 check((local_erased_at is null and gateway_device_id is not null and imei is not null and protocol_device_id is not null)
  or(local_erased_at is not null and gateway_device_id is null and imei is null and protocol_device_id is null)),
 unique(device_id,purpose,operation_key)
);
create index telematics_privacy_pending_idx on public.telematics_privacy_jobs(gateway_id,state,created_at,id);
alter table public.telematics_privacy_jobs enable row level security;
revoke all on public.telematics_privacy_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.telematics_privacy_jobs to service_role;

-- Executable implementation copies remain owner-only. Qualify their parameter
-- references with the copied routine name; preserve original-source fingerprints.
do $backup$
declare signature text;name text;backup_name text;definition text;backup_definition text;
begin
 foreach signature in array array['public.prepare_account_erasure(uuid,uuid)','public.finish_account_erasure(uuid,uuid)',
  'public.deactivate_own_account(uuid,text)','public.provision_telematics_device(uuid,jsonb)',
  'public.ingest_telematics_position(text,jsonb)','public.telematics_effective_location(uuid)'] loop
  name:=split_part(split_part(signature,'(',1),'.',2);backup_name:=name||'_pre_privacy154';
  if to_regprocedure(replace(signature,'public.'||name||'(','public.'||backup_name||'(')) is not null then raise exception 'TELEMATICS_PRIVACY_BACKUP_EXISTS';end if;
  definition:=pg_get_functiondef(signature::regprocedure);
  backup_definition:=replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(','CREATE OR REPLACE FUNCTION public.'||backup_name||'(');
  backup_definition:=replace(backup_definition,name||'.',backup_name||'.');
  execute backup_definition;
  execute format('revoke all on function %s from public,anon,authenticated,service_role',replace(signature,'public.'||name||'(','public.'||backup_name||'('));
  execute format('comment on function %s is %L',replace(signature,'public.'||name||'(','public.'||backup_name||'('),
   jsonb_build_object('migration',154,'original_signature',signature,'before_md5',md5(definition),'owner',(select proowner::regrole::text from pg_proc where oid=signature::regprocedure),
   'acl',(select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure))::text);
 end loop;
end $backup$;

create function public.telematics_privacy_fingerprint(device public.telematics_devices)
returns text language sql immutable set search_path=public,pg_temp as $$
 select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_object('id',device.id,'gateway',device.gateway_id,
  'gatewayDevice',device.gateway_device_id,'imei',device.imei,'protocol',device.protocol,'protocolDevice',device.protocol_device_id,
  'organization',device.organization_id,'provider',device.provider_profile_id)::text,'UTF8')),'hex');
$$;

create function public.telematics_lock_owner_scope(owner_org uuid,owner_provider uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if num_nonnulls(owner_org,owner_provider)<>1 then return false;end if;
 -- Canonical scope anchor, then owner profile, then caller's device lock.
 if owner_org is not null then
  perform 1 from organizations where id=owner_org and type='TRANSPORT_COMPANY' for key share;
  if not found then return false;end if;
  perform 1 from profiles p join organization_members m on m.user_id=p.id and m.membership_role='OWNER'
   where m.organization_id=owner_org order by p.id for share of p;
 else
  perform 1 from provider_profiles where id=owner_provider for key share;
  if not found then return false;end if;
  perform 1 from profiles p join provider_profiles x on x.user_id=p.id where x.id=owner_provider for share of p;
 end if;
 return exists(select 1 from profiles p join auth.users u on u.id=p.id and u.deleted_at is null where p.active and(
  owner_org is not null and p.role='TRANSPORTER' and exists(select 1 from organization_members m where m.user_id=p.id and m.organization_id=owner_org and m.membership_role='OWNER')
  or owner_provider is not null and p.role='DRIVER' and exists(select 1 from provider_profiles x where x.user_id=p.id and x.id=owner_provider)));
end $$;

create or replace function public.provision_telematics_device(actor_user_id uuid,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from profiles where id=actor_user_id and active and role='ADMIN') then raise exception 'FORBIDDEN';end if;
 if not public.telematics_lock_owner_scope(nullif(command->>'ownerOrganizationId','')::uuid,nullif(command->>'ownerProviderProfileId','')::uuid)
  then raise exception 'DEVICE_OWNER_INVALID';end if;
 return public.provision_telematics_device_pre_privacy154(actor_user_id,command);
exception when invalid_text_representation then raise exception 'INVALID_TELEMATICS_INPUT';
end $$;

create or replace function public.ingest_telematics_position(gateway_digest text,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare device telematics_devices%rowtype;
begin
 -- Read the binding without taking its lock; scope/profile always lock first.
 select d.* into device from telematics_devices d join telematics_gateways g on g.id=d.gateway_id and g.active
  where g.token_digest=gateway_digest and d.gateway_device_id=(command->>'gatewayDeviceId')::bigint
   and d.protocol=command->>'protocol' and d.protocol_device_id=command->>'protocolDeviceId' and d.active;
 if not found then return public.ingest_telematics_position_pre_privacy154(gateway_digest,command);end if;
 if not public.telematics_lock_owner_scope(device.organization_id,device.provider_profile_id) then raise exception 'DEVICE_OWNER_INVALID';end if;
 return public.ingest_telematics_position_pre_privacy154(gateway_digest,command);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'INVALID_TELEMATICS_INPUT';
end $$;

create or replace function public.telematics_effective_location(target_vehicle_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from vehicles v where v.id=target_vehicle_id and v.active and exists(
  select 1 from profiles p join auth.users u on u.id=p.id and u.deleted_at is null where p.active and(
   v.organization_id is not null and p.role='TRANSPORTER' and exists(select 1 from organization_members m where m.user_id=p.id and m.organization_id=v.organization_id and m.membership_role='OWNER')
   or v.provider_profile_id is not null and p.role='DRIVER' and exists(select 1 from provider_profiles x where x.user_id=p.id and x.id=v.provider_profile_id)))) then return null;end if;
 return public.telematics_effective_location_pre_privacy154(target_vehicle_id);
end $$;

create function public.queue_telematics_account_privacy(subject_id uuid,target_request_id uuid,job_purpose text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare orgs uuid[];providers uuid[];trucks uuid[];device telematics_devices%rowtype;stamp timestamptz:=clock_timestamp();operation text;fingerprint text;
begin
 if job_purpose not in('DISABLE','ERASE') or(job_purpose='ERASE') is distinct from(target_request_id is not null) then raise exception 'INVALID_TELEMATICS_PRIVACY_INPUT';end if;
 select coalesce(array_agg(organization_id),'{}') into orgs from organization_members where user_id=subject_id and membership_role='OWNER';
 select coalesce(array_agg(id),'{}') into providers from provider_profiles where user_id=subject_id;
 select coalesce(array_agg(id),'{}') into trucks from vehicles where organization_id=any(orgs) or provider_profile_id=any(providers);
 operation:=case when job_purpose='ERASE' then target_request_id::text else
  (select ((extract(epoch from account_deactivated_at)*1000000)::numeric)::text from profiles where id=subject_id) end;
 if operation is null then raise exception 'INVALID_TELEMATICS_PRIVACY_INPUT';end if;
 for device in select d.* from telematics_devices d where d.organization_id=any(orgs) or d.provider_profile_id=any(providers) order by d.id for update loop
  fingerprint:=public.telematics_privacy_fingerprint(device);
  insert into telematics_privacy_jobs(request_id,subject_user_id,device_id,gateway_id,purpose,operation_key,gateway_device_id,imei,protocol,protocol_device_id,device_fingerprint,binding_digest)
  values(target_request_id,subject_id,device.id,device.gateway_id,job_purpose,operation,device.gateway_device_id,device.imei,device.protocol,device.protocol_device_id,fingerprint,
   pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_array(job_purpose,operation,fingerprint)::text,'UTF8')),'hex'))
  on conflict(device_id,purpose,operation_key) do nothing;
  if exists(select 1 from telematics_privacy_jobs where device_id=device.id and purpose=job_purpose and operation_key=operation and device_fingerprint<>fingerprint)
   then raise exception 'PRIVACY_JOB_CHANGED';end if;
  update telematics_devices set active=false,revision=greatest(stamp,revision+interval '1 microsecond') where id=device.id and active;
  update telematics_device_assignments set ended_at=greatest(stamp,assigned_at) where device_id=device.id and ended_at is null;
  update telematics_engine_stepups set consumed_at=coalesce(consumed_at,stamp),expires_at=least(expires_at,stamp) where device_id=device.id and consumed_at is null;
  update telematics_commands set state=case when state='REQUESTED' then 'FAILED' else 'UNKNOWN' end,
   failure_code=case when state='REQUESTED' then 'ACCOUNT_CLOSED' else 'ACCOUNT_CLOSED_OUTCOME_UNKNOWN' end,lease_until=null
   where device_id=device.id and state in('REQUESTED','DISPATCHING','DISPATCHED');
 end loop;
end $$;

create or replace function public.prepare_account_erasure(actor_user_id uuid,target_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;subject_id uuid;
begin
 result:=public.prepare_account_erasure_pre_privacy154(actor_user_id,target_request_id);
 if result->>'status'='ERASING' then
  subject_id:=(result->>'subjectId')::uuid;
  perform public.queue_telematics_account_privacy(subject_id,target_request_id,'ERASE');
 end if;
 return result;
end $$;

create or replace function public.deactivate_own_account(actor_user_id uuid,confirmation text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 result:=public.deactivate_own_account_pre_privacy154(actor_user_id,confirmation);
 perform public.queue_telematics_account_privacy(actor_user_id,null,'DISABLE');
 return result;
end $$;

create or replace function public.finish_account_erasure(actor_user_id uuid,target_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare request account_deletion_requests%rowtype;orgs uuid[];providers uuid[];trucks uuid[];devices uuid[];
begin
 if not exists(select 1 from profiles where id=actor_user_id and active and role='ADMIN') then raise exception 'FORBIDDEN';end if;
 select * into request from account_deletion_requests where id=target_request_id;
 if not found then raise exception 'NOT_FOUND';end if;
 if request.status='COMPLETED' then return public.account_deletion_status(request.subject_user_id);end if;
 -- Match existing fleet/erasure order before locking any GPS device/job.
 perform 1 from organizations where id in(select organization_id from organization_members where user_id=request.subject_user_id and membership_role='OWNER') order by id for update;
 perform 1 from provider_profiles where user_id=request.subject_user_id order by id for update;
 perform 1 from profiles where id=request.subject_user_id for update;
 select * into request from account_deletion_requests where id=target_request_id for update;
 if request.status<>'ERASING' or exists(select 1 from account_erasure_files where request_id=request.id and removed_at is null)
  or exists(select 1 from auth.users where id=request.subject_user_id and deleted_at is null) then raise exception 'ERASURE_CLEANUP_INCOMPLETE';end if;
 select coalesce(array_agg(organization_id),'{}') into orgs from organization_members where user_id=request.subject_user_id and membership_role='OWNER';
 select coalesce(array_agg(id),'{}') into providers from provider_profiles where user_id=request.subject_user_id;
 select coalesce(array_agg(id),'{}') into trucks from vehicles where organization_id=any(orgs) or provider_profile_id=any(providers);
 perform 1 from telematics_devices where organization_id=any(orgs) or provider_profile_id=any(providers) order by id for update;
 select coalesce(array_agg(id),'{}') into devices from telematics_devices where organization_id=any(orgs) or provider_profile_id=any(providers);
 if exists(select 1 from telematics_devices d where d.id=any(devices) and not exists(
  select 1 from telematics_privacy_jobs j where j.device_id=d.id and j.request_id=request.id and j.purpose='ERASE' and j.state='VERIFIED'
   and j.device_fingerprint=public.telematics_privacy_fingerprint(d)))
  or exists(select 1 from telematics_privacy_jobs where request_id=request.id and purpose='ERASE' and state<>'VERIFIED') then
  return public.account_deletion_status(request.subject_user_id);
 end if;
 delete from telematics_location_sources where vehicle_id=any(trucks);
 delete from telematics_engine_stepups where owner_user_id=request.subject_user_id;
 delete from telematics_devices where id=any(devices);
 update telematics_privacy_jobs set gateway_device_id=null,imei=null,protocol_device_id=null,local_erased_at=clock_timestamp()
  where device_id=any(devices) and local_erased_at is null;
 return public.finish_account_erasure_pre_privacy154(actor_user_id,target_request_id);
end $$;

create function public.register_telematics_privacy_agent(actor_user_id uuid,target_gateway_id uuid,privacy_digest text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from profiles where id=actor_user_id and active and role='ADMIN') then raise exception 'FORBIDDEN';end if;
 if privacy_digest is null or privacy_digest!~'^[a-f0-9]{64}$' then raise exception 'INVALID_TELEMATICS_PRIVACY_INPUT';end if;
 update telematics_gateways set privacy_token_digest=privacy_digest where id=target_gateway_id and active and token_digest<>privacy_digest;
 if not found then raise exception 'PRIVACY_GATEWAY_UNAVAILABLE';end if;
 return target_gateway_id;
end $$;

create function public.authorize_telematics_privacy_gateway_request(gateway_digest text,nonce uuid,body_digest text,issued_at timestamptz)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare privacy_gateway_id uuid;
begin
 select id into privacy_gateway_id from telematics_gateways where privacy_token_digest=gateway_digest and active for share;
 if privacy_gateway_id is null or nonce is null or body_digest is null or body_digest!~'^[a-f0-9]{64}$'
  or issued_at is null or abs(extract(epoch from(clock_timestamp()-issued_at)))>120 then raise exception 'PRIVACY_GATEWAY_UNAVAILABLE';end if;
 insert into telematics_gateway_requests(gateway_id,nonce,body_digest,issued_at) values(privacy_gateway_id,nonce,body_digest,issued_at);
 return privacy_gateway_id;
exception when unique_violation then raise exception 'PRIVACY_GATEWAY_UNAVAILABLE';
end $$;

create function public.claim_telematics_privacy_jobs(gateway_digest text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare privacy_gateway_id uuid;job telematics_privacy_jobs%rowtype;stamp timestamptz:=clock_timestamp();lease uuid;
begin
 select id into privacy_gateway_id from telematics_gateways where privacy_token_digest=gateway_digest and active for share;
 if privacy_gateway_id is null then raise exception 'PRIVACY_GATEWAY_UNAVAILABLE';end if;
 select * into job from telematics_privacy_jobs j where j.gateway_id=privacy_gateway_id and j.local_erased_at is null
  and(j.state='PENDING' or j.state='LEASED' and j.lease_until<=stamp) order by j.created_at,j.id for update skip locked limit 1;
 if not found then return '[]'::jsonb;end if;
 lease:=gen_random_uuid();update telematics_privacy_jobs set state='LEASED',lease_id=lease,lease_until=stamp+interval '60 seconds' where id=job.id;
 return jsonb_build_array(jsonb_build_object('id',job.id,'purpose',job.purpose,'requestId',job.request_id,'subjectId',job.subject_user_id,'deviceId',job.device_id,
  'gatewayId',job.gateway_id,'gatewayDeviceId',job.gateway_device_id,'imei',job.imei,'protocol',job.protocol,'protocolDeviceId',job.protocol_device_id,
  'bindingDigest',job.binding_digest,'leaseId',lease,'leaseUntil',stamp+interval '60 seconds'));
end $$;

create function public.complete_telematics_privacy_job(gateway_digest text,command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare privacy_gateway_id uuid;job telematics_privacy_jobs%rowtype;device telematics_devices%rowtype;
begin
 select id into privacy_gateway_id from telematics_gateways where privacy_token_digest=gateway_digest and active for share;
 if privacy_gateway_id is null then raise exception 'PRIVACY_GATEWAY_UNAVAILABLE';end if;
 if command is null or jsonb_typeof(command)<>'object' or command->'verified' is distinct from 'true'::jsonb
  or not(command ?& array['jobId','leaseId','bindingDigest','verified'])
  or coalesce(command->>'bindingDigest','')!~'^[a-f0-9]{64}$'
  or exists(select 1 from jsonb_object_keys(command) key where key not in('jobId','leaseId','bindingDigest','verified')) then raise exception 'INVALID_TELEMATICS_PRIVACY_INPUT';end if;
 select * into job from telematics_privacy_jobs where id=(command->>'jobId')::uuid and telematics_privacy_jobs.gateway_id=privacy_gateway_id for update;
 if not found or job.lease_id is distinct from(command->>'leaseId')::uuid or job.binding_digest is distinct from command->>'bindingDigest'
  then raise exception 'PRIVACY_JOB_CHANGED';end if;
 if job.state='VERIFIED' then return jsonb_build_object('id',job.id,'state','VERIFIED');end if;
 if job.state<>'LEASED' or job.lease_until<=clock_timestamp() then raise exception 'PRIVACY_JOB_CHANGED';end if;
 select * into device from telematics_devices where id=job.device_id;
 if not found or public.telematics_privacy_fingerprint(device)<>job.device_fingerprint then raise exception 'PRIVACY_JOB_CHANGED';end if;
 update telematics_privacy_jobs set state='VERIFIED',verified_at=clock_timestamp() where id=job.id;
 insert into audit_logs(action,entity_type,entity_id,details) values('TELEMATICS_PRIVACY_VERIFIED','telematics_privacy_job',job.id,jsonb_build_object('purpose',job.purpose));
 return jsonb_build_object('id',job.id,'state','VERIFIED');
exception when invalid_text_representation then raise exception 'INVALID_TELEMATICS_PRIVACY_INPUT';
end $$;

do $acl$
declare routine text;
begin
 foreach routine in array array['telematics_privacy_fingerprint(public.telematics_devices)','telematics_lock_owner_scope(uuid,uuid)',
  'queue_telematics_account_privacy(uuid,uuid,text)','prepare_account_erasure(uuid,uuid)','finish_account_erasure(uuid,uuid)',
  'deactivate_own_account(uuid,text)','provision_telematics_device(uuid,jsonb)','ingest_telematics_position(text,jsonb)',
  'telematics_effective_location(uuid)','register_telematics_privacy_agent(uuid,uuid,text)','authorize_telematics_privacy_gateway_request(text,uuid,text,timestamptz)',
  'claim_telematics_privacy_jobs(text)','complete_telematics_privacy_job(text,jsonb)'] loop
  execute format('revoke all on function public.%s from public,anon,authenticated,service_role',routine);
  if routine not in('telematics_privacy_fingerprint(public.telematics_devices)','telematics_lock_owner_scope(uuid,uuid)',
   'queue_telematics_account_privacy(uuid,uuid,text)','telematics_effective_location(uuid)') then execute format('grant execute on function public.%s to service_role',routine);end if;
 end loop;
end $acl$;
notify pgrst,'reload schema';
commit;
