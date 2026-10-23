-- FEAT-VER/FLT/CAP/PRV-001 / ADR-079. Depends on 145's explicit fleet scope.
-- No legacy approval is upgraded, no private file or saved signal is rewritten.
begin;
select pg_advisory_xact_lock(8030146);
alter type public.verification_type add value if not exists 'VEHICLE_OPERATING_LICENSE';

create table public.provider_vehicle_authority_reviews (
 id uuid primary key default gen_random_uuid(),
 -- Existing reviewed account erasure deletes source metadata and private notes.
 -- Pseudonymous audit events remain; ordinary revocation never deletes reviews.
 source_request_id uuid not null references public.verification_requests(id) on delete cascade,
 vehicle_id uuid not null references public.vehicles(id),
 vehicle_identity_digest text not null check(vehicle_identity_digest~'^[a-f0-9]{64}$'),
 organization_id uuid references public.organizations(id),
 provider_profile_id uuid references public.provider_profiles(id),
 fact_kind text not null check(fact_kind in ('OWNERSHIP','PERMISSION','OPERATING_LICENCE')),
 holder_basis text check(holder_basis in ('OWNED','FINANCED')),
 expires_on date,
 reviewed_by uuid not null references public.profiles(id),
 reviewed_at timestamptz not null default now(),
 review_note text not null check(length(trim(review_note)) between 5 and 500),
 revoked_by uuid references public.profiles(id),revoked_at timestamptz,revocation_reason text,
 check((organization_id is null)<>(provider_profile_id is null)),
 check((fact_kind='OPERATING_LICENCE')=(holder_basis is not null)),
 check(fact_kind='OWNERSHIP' or expires_on is not null),
 check((revoked_at is null and revoked_by is null and revocation_reason is null)
   or (revoked_at is not null and revoked_by is not null and length(trim(revocation_reason)) between 5 and 500))
);
alter table public.provider_vehicle_authority_reviews enable row level security;
revoke all on public.provider_vehicle_authority_reviews from public,anon,authenticated;
grant select,insert,update on public.provider_vehicle_authority_reviews to service_role;
create unique index provider_vehicle_authority_current_source_idx
 on public.provider_vehicle_authority_reviews(source_request_id,fact_kind) where revoked_at is null;
create index provider_vehicle_authority_vehicle_idx
 on public.provider_vehicle_authority_reviews(vehicle_id,fact_kind,reviewed_at desc) where revoked_at is null;
create index provider_vehicle_authority_org_idx
 on public.provider_vehicle_authority_reviews(organization_id,vehicle_id) where revoked_at is null;
create index provider_vehicle_authority_profile_idx
 on public.provider_vehicle_authority_reviews(provider_profile_id,vehicle_id) where revoked_at is null;

-- Preserve installed definitions and metadata for private recovery analysis.
-- NR-47's rollback deliberately fails closed: only a separately reviewed
-- compatible forward repair may use this inventory; no automatic restoration.
create table public.provider_authority_function_backups (
 signature text primary key,definition text not null,definition_md5 text not null,
 owner_name text not null,acl text,settings text[],description text,candidate_md5 text
);
alter table public.provider_authority_function_backups enable row level security;
revoke all on public.provider_authority_function_backups from public,anon,authenticated,service_role;
do $backup$
declare signature text;
begin
 foreach signature in array array[
  'public.public_capacity_page(jsonb,timestamp with time zone,uuid,integer)',
  'public.capacity_search_public_rows(jsonb,timestamp with time zone,uuid,integer)',
  'public.private_capacity_filtered_page(text,text,uuid,timestamp with time zone,uuid,integer,jsonb)',
  'public.capacity_search_private_rows(text,text,uuid,timestamp with time zone,uuid,integer,jsonb)',
  'public.public_provider_fleet_page(uuid,uuid,integer)',
  'public.public_featured_provider_candidates(text[])',
  'public.featured_eligible_truck_links(text[])',
  'public.managed_verification_center(uuid)',
  'public.managed_verification_controls_truck(uuid,uuid)',
  'public.submit_managed_verification(uuid,jsonb)',
  'public.set_vehicle_lifecycle(uuid,uuid,boolean,text)',
  'public.capacity_search_metadata(jsonb)'
 ] loop
  if to_regprocedure(signature) is null then raise exception 'PROVIDER_AUTHORITY_BASE_MISSING: %',signature;end if;
  insert into public.provider_authority_function_backups(signature,definition,definition_md5,owner_name,acl,settings,description)
  select signature,pg_get_functiondef(p.oid),md5(pg_get_functiondef(p.oid)),p.proowner::regrole::text,p.proacl::text,p.proconfig,obj_description(p.oid,'pg_proc')
  from pg_proc p where p.oid=to_regprocedure(signature);
 end loop;
end $backup$;

create function public.provider_vehicle_authority_identity(target_vehicle public.vehicles)
returns text language sql immutable security invoker set search_path='' as $$
 select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
  'plate',pg_catalog.upper(pg_catalog.btrim(coalesce(target_vehicle.plate,''))),
  'make',pg_catalog.lower(pg_catalog.btrim(coalesce(target_vehicle.make,''))),
  'model',pg_catalog.lower(pg_catalog.btrim(coalesce(target_vehicle.model,''))),
  'useBasis',target_vehicle.use_basis)::text,'UTF8')),'hex')
$$;
revoke all on function public.provider_vehicle_authority_identity(public.vehicles) from public,anon,authenticated,service_role;

-- An opaque staff-form revision binds the document, current exact beneficiary,
-- physical identity and confirmation/revocation epoch. It is not a credential.
create function public.provider_authority_context_revision(target_request public.verification_requests,target_vehicle public.vehicles)
returns text language sql stable security invoker set search_path='' as $$
 select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
  'requestId',target_request.id,'subjectType',target_request.subject_type,'subjectId',target_request.subject_id,
  'type',target_request.verification_type::text,'status',target_request.status,'expiresOn',target_request.expires_on,
  'reviewedAt',target_request.reviewed_at,'sourceReference',target_request.storage_path,
  'vehicleId',target_vehicle.id,'vehicleIdentity',public.provider_vehicle_authority_identity(target_vehicle),
  'organizationId',target_vehicle.organization_id,'providerProfileId',target_vehicle.provider_profile_id,
  'authorityEpoch',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',a.id,'revokedAt',a.revoked_at) order by a.id)
   from public.provider_vehicle_authority_reviews a where a.source_request_id=target_request.id))::text,'UTF8')),'hex')
$$;
revoke all on function public.provider_authority_context_revision(public.verification_requests,public.vehicles) from public,anon,authenticated,service_role;

-- Relational truth shared by the full-fleet count, gate and badge projections.
-- No grantee is inferred from the submitter or an active driver assignment.
create function public.current_provider_vehicle_authority()
returns table(review_id uuid,source_request_id uuid,vehicle_id uuid,organization_id uuid,provider_profile_id uuid,
 fact_kind text,holder_basis text,reviewed_at timestamptz,expires_on date)
language sql stable security invoker as $$
 select a.id,a.source_request_id,a.vehicle_id,a.organization_id,a.provider_profile_id,a.fact_kind,a.holder_basis,a.reviewed_at,a.expires_on
 from public.provider_vehicle_authority_reviews a
 join public.verification_requests r on r.id=a.source_request_id and r.status='APPROVED'
 join public.vehicles v on v.id=a.vehicle_id and v.active
 where a.revoked_at is null and (a.expires_on is null or a.expires_on>=(now() at time zone 'Africa/Addis_Ababa')::date)
 and (r.expires_on is null or r.expires_on>=(now() at time zone 'Africa/Addis_Ababa')::date)
 and v.organization_id is not distinct from a.organization_id
 and v.provider_profile_id is not distinct from a.provider_profile_id
 and a.vehicle_identity_digest=public.provider_vehicle_authority_identity(v)
 and ((r.subject_type='VEHICLE' and r.subject_id=v.id)
   or (a.fact_kind='PERMISSION' and r.subject_type='PROVIDER_PROFILE' and r.subject_id=v.provider_profile_id and r.related_vehicle_id=v.id))
 and ((a.fact_kind='OWNERSHIP' and r.verification_type::text='VEHICLE_OWNERSHIP')
   or (a.fact_kind='PERMISSION' and r.verification_type::text='VEHICLE_AUTHORIZATION')
   or (a.fact_kind='OPERATING_LICENCE' and r.verification_type::text='VEHICLE_OPERATING_LICENSE' and a.holder_basis in ('OWNED','FINANCED')))
$$;
revoke all on function public.current_provider_vehicle_authority() from public,anon,authenticated,service_role;

create function public.provider_scope_can_publish(target_organization_id uuid,target_provider_profile_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select (target_organization_id is null)<>(target_provider_profile_id is null)
 and (exists(select 1 from public.organizations o
    join public.organization_members m on m.organization_id=o.id and m.membership_role='OWNER'
    join public.profiles p on p.id=m.user_id and p.active and p.role='TRANSPORTER'
    join auth.users u on u.id=p.id and u.deleted_at is null
    where o.id=target_organization_id and o.type='TRANSPORT_COMPANY')
  or exists(select 1 from public.provider_profiles owner
    join public.profiles p on p.id=owner.user_id and p.active and p.role='DRIVER'
    join auth.users u on u.id=p.id and u.deleted_at is null
    where owner.id=target_provider_profile_id))
 and (exists(select 1 from public.current_provider_vehicle_authority() a
  where a.organization_id is not distinct from target_organization_id and a.provider_profile_id is not distinct from target_provider_profile_id
  and (a.fact_kind='OWNERSHIP' or a.fact_kind='OPERATING_LICENCE' and a.holder_basis in ('OWNED','FINANCED')))
  or (select count(*) from public.vehicles v where v.active and v.publication_status='LIVE'
    and(v.organization_id=target_organization_id or v.provider_profile_id=target_provider_profile_id))<=1)
$$;
revoke all on function public.provider_scope_can_publish(uuid,uuid) from public,anon,authenticated,service_role;

create function public.provider_vehicle_authority_state(target_vehicle_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with latest as (
  select distinct on(a.fact_kind) a.* from public.current_provider_vehicle_authority() a where a.vehicle_id=target_vehicle_id
  order by a.fact_kind,a.reviewed_at desc,a.review_id desc
 ) select jsonb_build_object(
  'ownership',jsonb_build_object('verified',exists(select 1 from latest where fact_kind='OWNERSHIP'),
   'reviewedAt',(select reviewed_at from latest where fact_kind='OWNERSHIP'),'expiresOn',(select expires_on from latest where fact_kind='OWNERSHIP')),
  'permission',jsonb_build_object('verified',exists(select 1 from latest where fact_kind='PERMISSION'),
   'reviewedAt',(select reviewed_at from latest where fact_kind='PERMISSION'),'expiresOn',(select expires_on from latest where fact_kind='PERMISSION')),
  'operatingLicence',jsonb_build_object('verified',exists(select 1 from latest where fact_kind='OPERATING_LICENCE'),
   'holderBasis',(select holder_basis from latest where fact_kind='OPERATING_LICENCE'),
   'reviewedAt',(select reviewed_at from latest where fact_kind='OPERATING_LICENCE'),'expiresOn',(select expires_on from latest where fact_kind='OPERATING_LICENCE')),
  'qualifiesProvider',exists(select 1 from latest where fact_kind='OWNERSHIP' or fact_kind='OPERATING_LICENCE' and holder_basis in ('OWNED','FINANCED')))
$$;
revoke all on function public.provider_vehicle_authority_state(uuid) from public,anon,authenticated,service_role;

create function public.provider_vehicle_authority_states(requested_vehicle_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if requested_vehicle_ids is null or cardinality(requested_vehicle_ids)>100 or coalesce(array_ndims(requested_vehicle_ids),1)>1
  or array_position(requested_vehicle_ids,null) is not null then raise exception 'INVALID_AUTHORITY_VEHICLE_SCOPE';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('vehicleId',v.id,'authority',public.provider_vehicle_authority_state(v.id)) order by v.id),'[]'::jsonb)
  from public.vehicles v where v.id=any(requested_vehicle_ids));
end $$;
revoke all on function public.provider_vehicle_authority_states(uuid[]) from public,anon,authenticated;
grant execute on function public.provider_vehicle_authority_states(uuid[]) to service_role;

create function public.managed_provider_publication_eligibility(actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare scope record;total integer;owned integer;licensed integer;live_count integer;
begin
 select * into scope from public.fleet_provider_owner_scope(actor_user_id);if not found then raise exception 'FORBIDDEN';end if;
 select count(distinct a.vehicle_id),count(distinct a.vehicle_id) filter(where a.fact_kind='OWNERSHIP'),
  count(distinct a.vehicle_id) filter(where a.fact_kind='OPERATING_LICENCE') into total,owned,licensed
 from public.current_provider_vehicle_authority() a
 where a.organization_id is not distinct from scope.organization_id and a.provider_profile_id is not distinct from scope.provider_profile_id
 and (a.fact_kind='OWNERSHIP' or a.fact_kind='OPERATING_LICENCE' and a.holder_basis in ('OWNED','FINANCED'));
 select count(*) into live_count from public.vehicles v where v.active and v.publication_status='LIVE'
  and(v.organization_id=scope.organization_id or v.provider_profile_id=scope.provider_profile_id);
 return jsonb_build_object('canPublish',total>0 or live_count<1,'liveTruckCount',live_count,
  'qualifyingTruckCount',total,'qualifyingOwnershipCount',owned,'qualifyingLicenceCount',licensed);
end $$;
revoke all on function public.managed_provider_publication_eligibility(uuid) from public,anon,authenticated;
grant execute on function public.managed_provider_publication_eligibility(uuid) to service_role;

create function public.confirm_provider_vehicle_authority(actor_user_id uuid,request_id uuid,command jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.verification_requests%rowtype;v public.vehicles%rowtype;fact text:=command->>'fact_kind';basis text:=command->>'holder_basis';
 expiry date;note text:=trim(coalesce(command->>'review_note',''));new_id uuid:=gen_random_uuid();
begin
 if not public.managed_actor_has_permission(actor_user_id,'TRUST') then raise exception 'FORBIDDEN';end if;
 if command is null or jsonb_typeof(command)<>'object' or fact is null or fact not in ('OWNERSHIP','PERMISSION','OPERATING_LICENCE') then raise exception 'INVALID_AUTHORITY_FACT';end if;
 if char_length(note) not between 5 and 500 then raise exception 'AUTHORITY_REVIEW_NOTE_REQUIRED';end if;
 select * into r from public.verification_requests x where x.id=request_id for share;
 if not found then raise exception 'NOT_FOUND';end if;
 if r.status<>'APPROVED' then raise exception 'AUTHORITY_SOURCE_NOT_APPROVED';end if;
 select * into v from public.vehicles x where x.id=case when r.subject_type='VEHICLE' then r.subject_id else r.related_vehicle_id end and x.active for update;
 if not found then raise exception 'AUTHORITY_SOURCE_MISMATCH';end if;
 if not ((r.subject_type='VEHICLE' and r.subject_id=v.id)
   or (fact='PERMISSION' and r.subject_type='PROVIDER_PROFILE' and r.subject_id=v.provider_profile_id and r.related_vehicle_id=v.id))
  or not ((fact='OWNERSHIP' and r.verification_type::text='VEHICLE_OWNERSHIP')
    or(fact='PERMISSION' and r.verification_type::text='VEHICLE_AUTHORIZATION')
    or(fact='OPERATING_LICENCE' and r.verification_type::text='VEHICLE_OPERATING_LICENSE')) then raise exception 'AUTHORITY_SOURCE_MISMATCH';end if;
 if fact='OPERATING_LICENCE' and (basis is null or basis not in ('OWNED','FINANCED')) then raise exception 'AUTHORITY_HOLDER_BASIS_REQUIRED';end if;
 if fact<>'OPERATING_LICENCE' and basis is not null then raise exception 'AUTHORITY_SOURCE_MISMATCH';end if;
 begin expiry:=nullif(command->>'expires_on','')::date;exception when others then raise exception 'AUTHORITY_EXPIRY_INVALID';end;
 if fact<>'OWNERSHIP' and expiry is null then raise exception 'AUTHORITY_EXPIRY_REQUIRED';end if;
 expiry:=coalesce(expiry,r.expires_on);
 if expiry<(now() at time zone 'Africa/Addis_Ababa')::date or r.expires_on<(now() at time zone 'Africa/Addis_Ababa')::date
   or (r.expires_on is not null and (expiry is null or expiry>r.expires_on)) then raise exception 'AUTHORITY_EXPIRY_INVALID';end if;
 if exists(select 1 from public.provider_vehicle_authority_reviews a where a.source_request_id=r.id and a.fact_kind=fact and a.revoked_at is null) then raise exception 'AUTHORITY_ALREADY_CONFIRMED';end if;
 if command->>'context_revision' is distinct from public.provider_authority_context_revision(r,v) then raise exception 'AUTHORITY_CONTEXT_CHANGED';end if;
 insert into public.provider_vehicle_authority_reviews(id,source_request_id,vehicle_id,vehicle_identity_digest,organization_id,provider_profile_id,fact_kind,holder_basis,expires_on,reviewed_by,review_note)
 values(new_id,r.id,v.id,public.provider_vehicle_authority_identity(v),v.organization_id,v.provider_profile_id,fact,basis,expiry,actor_user_id,note);
 insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,v.organization_id,'PROVIDER_TRUCK_AUTHORITY_CONFIRMED','provider_vehicle_authority_review',new_id,
  jsonb_build_object('source_request_id',r.id,'vehicle_id',v.id,'provider_profile_id',v.provider_profile_id,'fact_kind',fact,'holder_basis',basis,'expires_on',expiry));
 return new_id;
end $$;
revoke all on function public.confirm_provider_vehicle_authority(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.confirm_provider_vehicle_authority(uuid,uuid,jsonb) to service_role;

create function public.revoke_provider_vehicle_authority(actor_user_id uuid,authority_review_id uuid,reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.provider_vehicle_authority_reviews%rowtype;note text:=trim(coalesce(reason,''));
begin
 if not public.managed_actor_has_permission(actor_user_id,'TRUST') then raise exception 'FORBIDDEN';end if;
 if char_length(note) not between 5 and 500 then raise exception 'AUTHORITY_REVIEW_NOTE_REQUIRED';end if;
 select * into r from public.provider_vehicle_authority_reviews a where a.id=authority_review_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if r.revoked_at is not null then raise exception 'AUTHORITY_ALREADY_REVOKED';end if;
 update public.provider_vehicle_authority_reviews set revoked_by=actor_user_id,revoked_at=now(),revocation_reason=note where id=r.id;
 insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,r.organization_id,'PROVIDER_TRUCK_AUTHORITY_REVOKED','provider_vehicle_authority_review',r.id,
  jsonb_build_object('vehicle_id',r.vehicle_id,'source_request_id',r.source_request_id,'reason',note));
end $$;
revoke all on function public.revoke_provider_vehicle_authority(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.revoke_provider_vehicle_authority(uuid,uuid,text) to service_role;

create function public.set_provider_vehicle_publication(actor_user_id uuid,target_vehicle_id uuid,requested_state text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare scope record;v public.vehicles%rowtype;
begin
 -- Serialize the single unreviewed slot across different target trucks. The
 -- shared owner lock is acquired before the target truck, then authority is
 -- rechecked by fleet_lock_provider_owner after any concurrent closure/change.
 select * into scope from public.fleet_lock_provider_owner(actor_user_id);if not found then raise exception 'FORBIDDEN';end if;
 if requested_state is null or requested_state not in ('DRAFT','LIVE') then raise exception 'INVALID_PUBLICATION_STATE';end if;
 if requested_state='LIVE' then perform public.require_content_policy(actor_user_id);end if;
 select * into v from public.vehicles x where x.id=target_vehicle_id and x.active for update;
 if not found or v.organization_id is distinct from scope.organization_id or v.provider_profile_id is distinct from scope.provider_profile_id then raise exception 'NOT_FOUND';end if;
 if requested_state='LIVE' and v.publication_status<>'LIVE'
 and exists(select 1 from public.vehicles other where other.active and other.publication_status='LIVE' and other.id<>v.id
  and(other.organization_id=scope.organization_id or other.provider_profile_id=scope.provider_profile_id))
 and not exists(select 1 from public.current_provider_vehicle_authority() a
  where a.organization_id is not distinct from scope.organization_id and a.provider_profile_id is not distinct from scope.provider_profile_id
  and(a.fact_kind='OWNERSHIP' or a.fact_kind='OPERATING_LICENCE' and a.holder_basis in('OWNED','FINANCED')))
 then raise exception 'PROVIDER_VERIFICATION_REQUIRED';end if;
 if v.publication_status<>requested_state then
  update public.vehicles set publication_status=requested_state where id=v.id;
  insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
  values(actor_user_id,v.organization_id,'PROVIDER_TRUCK_PUBLICATION_CHANGED','vehicle',v.id,
   jsonb_build_object('from',v.publication_status,'to',requested_state,'provider_profile_id',v.provider_profile_id));
 end if;
 return jsonb_build_object('vehicleId',v.id,'state',requested_state);
end $$;
revoke all on function public.set_provider_vehicle_publication(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.set_provider_vehicle_publication(uuid,uuid,text) to service_role;

-- Restoring a stored Live choice must not silently consume a second free slot.
-- Keep its records/audience/history; the owner explicitly takes it Live again.
do $restore_publication$
declare definition text;anchor text;replacement text;
begin
 definition:=pg_get_functiondef('public.set_vehicle_lifecycle(uuid,uuid,boolean,text)'::regprocedure);
 anchor:=$old$ update vehicles set active=desired_active where id=vehicle.id;$old$;
 replacement:=$new$ update vehicles set active=desired_active,
  publication_status=case when desired_active then 'DRAFT' else publication_status end where id=vehicle.id;$new$;
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_RESTORE_PUBLICATION_DRIFT';end if;
 execute replace(definition,anchor,replacement);
end $restore_publication$;

create function public.keep_provider_capacity_publication() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if coalesce(new.market_status,new.status::text) in ('EMPTY','PARTIAL') then
  if not exists(select 1 from public.vehicles v where v.id=new.vehicle_id and v.active and v.publication_status='LIVE')
  then raise exception 'TRUCK_NOT_LIVE';end if;
  if not public.provider_vehicle_discovery_allows(new.vehicle_id) then raise exception 'PROVIDER_VERIFICATION_REQUIRED';end if;
 end if;
 return new;
end $$;
revoke all on function public.keep_provider_capacity_publication() from public,anon,authenticated,service_role;
-- Only a new signal is publication. Approximate location refreshes and ongoing
-- shipment location/proof updates remain authorized by their existing commands.
create trigger provider_capacity_publication before insert on public.capacities
 for each row execute function public.keep_provider_capacity_publication();

-- This helper deliberately does NOT replace capacity_public_policy_allows:
-- existing authorized Tracking must remain available after qualification loss.
create function public.provider_vehicle_discovery_allows(target_vehicle_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.vehicles v where v.id=target_vehicle_id and v.active and v.publication_status='LIVE'
  and public.provider_scope_can_publish(v.organization_id,v.provider_profile_id))
$$;
revoke all on function public.provider_vehicle_discovery_allows(uuid) from public,anon,authenticated,service_role;

-- Aggregate every current disclosed truck; no per-page or availability count.
create function public.provider_fleet_authority_summary(target_organization_id uuid,target_provider_profile_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with fleet as (
  select v.id from public.vehicles v where v.active and v.publication_status='LIVE'
   and v.organization_id is not distinct from target_organization_id and v.provider_profile_id is not distinct from target_provider_profile_id
   and public.provider_scope_can_publish(v.organization_id,v.provider_profile_id)
   and public.capacity_public_policy_allows(v.id)
   and exists(select 1 from public.company_pages page where page.published and(page.organization_id=v.organization_id or page.provider_profile_id=v.provider_profile_id))
   and(exists(select 1 from public.organizations owner where owner.id=v.organization_id and owner.public_visibility='PUBLIC')
    or exists(select 1 from public.provider_profiles owner where owner.id=v.provider_profile_id and owner.public_visibility='PUBLIC'))
 ), facts as (
  select f.id,bool_or(a.fact_kind='OWNERSHIP') as owned,
   bool_or(a.fact_kind='OPERATING_LICENCE' and a.holder_basis='FINANCED') as financed,
   bool_or(a.fact_kind='PERMISSION') as permission,bool_or(a.fact_kind='OPERATING_LICENCE') as licence
  from fleet f left join public.current_provider_vehicle_authority() a on a.vehicle_id=f.id group by f.id
 ) select jsonb_build_object('total',count(*),'ownershipVerified',count(*) filter(where owned),
  'financedVerified',count(*) filter(where not coalesce(owned,false) and financed),
  'permissionVerified',count(*) filter(where not coalesce(owned,false) and not coalesce(licence,false) and permission),
  'notYetVerified',count(*) filter(where not coalesce(owned,false) and not coalesce(licence,false) and not coalesce(permission,false)),
  'operatingLicenceVerified',count(*) filter(where not coalesce(owned,false) and licence)) from facts
$$;
revoke all on function public.provider_fleet_authority_summary(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.public_provider_fleet_page(requested_organization_id uuid default null,requested_provider_profile_id uuid default null,requested_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare total integer;page_number integer;page_count integer;trucks jsonb;summary jsonb;
begin
 if(requested_organization_id is null)=(requested_provider_profile_id is null) then raise exception 'INVALID_PROVIDER_SCOPE';end if;
 if not exists(select 1 from public.company_pages p where p.published and(p.organization_id=requested_organization_id or p.provider_profile_id=requested_provider_profile_id)) then return null;end if;
 if requested_organization_id is not null and not exists(select 1 from public.organizations o where o.id=requested_organization_id and o.type='TRANSPORT_COMPANY' and o.public_visibility='PUBLIC' and not o.content_hidden and not o.review_workspace) then return null;end if;
 if requested_provider_profile_id is not null and not exists(select 1 from public.provider_profiles p where p.id=requested_provider_profile_id and p.public_visibility='PUBLIC' and not p.content_hidden and not p.review_workspace) then return null;end if;
 summary:=public.provider_fleet_authority_summary(requested_organization_id,requested_provider_profile_id);total:=(summary->>'total')::integer;
 page_count:=greatest(1,ceil(total/12.0)::integer);page_number:=least(page_count,greatest(1,coalesce(requested_page,1)));
 select coalesce(jsonb_agg(to_jsonb(row) order by row.platform_number,row.id),'[]'::jsonb) into trucks from(
  select v.id,v.platform_number,v.make,v.model,v.category,v.cargo_configuration,
   public.capacity_active_driver_id(v.id) as assigned_driver_id,public.provider_vehicle_authority_state(v.id) as authority
  from public.vehicles v where v.active and v.publication_status='LIVE' and(v.organization_id=requested_organization_id or v.provider_profile_id=requested_provider_profile_id)
  and public.provider_scope_can_publish(v.organization_id,v.provider_profile_id)
  and public.capacity_public_policy_allows(v.id)
  order by v.platform_number,v.id offset(page_number-1)*12 limit 12
 ) row;
 return jsonb_build_object('items',trucks,'total',total,'page',page_number,'page_size',12,'page_count',page_count,
  'owner_operator',false,'evidence',null,'authority_summary',summary);
end $$;

-- Public and email/private queries gate BEFORE counting/cursor windows. Preserve
-- their installed sharing, moderation, matching, 130 lazy scans and 139 OR rules.
do $discovery$
declare signature text;definition text;anchor text;replacement text;owner_alias text;profile_user text;
begin
 foreach signature in array array['public.public_capacity_page(jsonb,timestamp with time zone,uuid,integer)',
 'public.capacity_search_public_rows(jsonb,timestamp with time zone,uuid,integer)',
 'public.private_capacity_filtered_page(text,text,uuid,timestamp with time zone,uuid,integer,jsonb)',
 'public.capacity_search_private_rows(text,text,uuid,timestamp with time zone,uuid,integer,jsonb)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);anchor:='where capacity.latest_position=1';
  if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_DISCOVERY_ANCHOR_DRIFT: %',signature;end if;
  replacement:=anchor||E' and vehicle.publication_status=''LIVE''\n and public.provider_scope_can_publish(vehicle.organization_id,vehicle.provider_profile_id)';
  definition:=replace(definition,anchor,replacement);
  -- Add an allowlisted fact object to the already-authorized truck payload.
  if strpos(signature,'private')>0 then anchor:='''platform_number'',vehicle.platform_number';
   replacement:='''authority'',public.provider_vehicle_authority_state(vehicle.id),'||anchor;
  else anchor:='''id'',id,''vehicle_id'',vehicle_id';
   replacement:='''authority'',public.provider_vehicle_authority_state(vehicle_id),'||anchor;
  end if;
  if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_PAYLOAD_ANCHOR_DRIFT: %',signature;end if;
  definition:=replace(definition,anchor,replacement);
  -- Every provider can employ drivers. Identity/licence evidence follows the
  -- actual assignment, rather than automatically becoming the account owner's.
  owner_alias:=case when strpos(signature,'private')>0 then 'capacity' else 'candidate' end;
  profile_user:=case when strpos(signature,'private')>0 then 'provider.user_id' else 'candidate.profile_user_id' end;
  anchor:='('||owner_alias||'.provider_organization_id is not null and request.subject_type=''DRIVER'' and request.subject_id=assignment.driver_user_id)';
  replacement:='(request.subject_type=''DRIVER'' and request.subject_id=assignment.driver_user_id)';
  if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>2 then raise exception 'AUTHORITY_DRIVER_DOCUMENT_SCOPE_DRIFT: %',signature;end if;
  definition:=replace(definition,anchor,replacement);
  anchor:='or ('||owner_alias||'.provider_profile_id is not null and request.subject_type=''PROVIDER_PROFILE'' and request.subject_id='||owner_alias||'.provider_profile_id))'||E'\n  ) driver_documents on true';
  replacement:='or ('||owner_alias||'.provider_profile_id is not null and assignment.driver_user_id='||profile_user||' and request.subject_type=''PROVIDER_PROFILE'' and request.subject_id='||owner_alias||'.provider_profile_id))'||E'\n  ) driver_documents on true';
  if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_DRIVER_OWNER_DOCUMENT_DRIFT: %',signature;end if;
  execute replace(definition,anchor,replacement);
 end loop;
end $discovery$;

-- Featured provider and truck selection honor the same current qualification.
do $featured$
declare definition text;anchor text;
begin
 definition:=pg_get_functiondef('public.public_featured_provider_candidates(text[])'::regprocedure);
 anchor:='candidate.page_published and candidate.has_public_contact';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_FEATURED_PROVIDER_ANCHOR_DRIFT';end if;
 definition:=replace(definition,anchor,anchor||E' and public.provider_scope_can_publish(candidate.provider_organization_id,candidate.provider_profile_id)');
 anchor:='filter(where vehicle.active)::integer as fleet_size';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_FEATURED_DRAFT_COUNT_DRIFT';end if;
 definition:=replace(definition,anchor,'filter(where vehicle.active and vehicle.publication_status=''LIVE'' and public.capacity_public_policy_allows(vehicle.id))::integer as fleet_size');
 anchor:=E'filter(where vehicle.active\n        and coalesce(capacity.market_status';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_FEATURED_DRAFT_CAPACITY_DRIFT';end if;
 execute replace(definition,anchor,E'filter(where vehicle.active and vehicle.publication_status=''LIVE'' and public.capacity_public_policy_allows(vehicle.id)\n        and coalesce(capacity.market_status');
 definition:=pg_get_functiondef('public.featured_eligible_truck_links(text[])'::regprocedure);
 anchor:='where vehicle.active';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_FEATURED_TRUCK_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,anchor||E' and vehicle.publication_status=''LIVE'' and public.provider_scope_can_publish(vehicle.organization_id,vehicle.provider_profile_id)');
end $featured$;

create or replace function public.managed_verification_controls_truck(actor_user_id uuid,target_vehicle_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.fleet_actor_can_use_vehicle(actor_user_id,target_vehicle_id,false)
$$;

create function public.managed_verification_controls_driver(actor_user_id uuid,target_driver_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles actor join public.profiles target on target.id=target_driver_id and target.active
 where actor.id=actor_user_id and actor.active and(
  actor.id=target.id and(actor.role='DRIVER' and exists(select 1 from public.drivers d where d.user_id=actor.id and d.active)
   or actor.drives_truck and exists(select 1 from public.driver_vehicle_assignments a where a.driver_user_id=actor.id and a.active
    and public.fleet_actor_can_use_vehicle(actor.id,a.vehicle_id,false)))
  or exists(select 1 from public.drivers d where d.user_id=target.id and d.active and(
   actor.role='TRANSPORTER' and exists(select 1 from public.organization_members m where m.user_id=actor.id and m.membership_role='OWNER' and m.organization_id=d.organization_id)
   or actor.role='DRIVER' and exists(select 1 from public.provider_profiles p where p.user_id=actor.id and p.id=d.provider_profile_id)))
 ))
$$;
revoke all on function public.managed_verification_controls_driver(uuid,uuid) from public,anon,authenticated,service_role;

create function public.managed_provider_authority_review_context(actor_user_id uuid,requested_request_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.managed_actor_has_permission(actor_user_id,'TRUST') then raise exception 'FORBIDDEN';end if;
 if requested_request_ids is null or cardinality(requested_request_ids)>50 or coalesce(array_ndims(requested_request_ids),1)>1
 or array_position(requested_request_ids,null) is not null then raise exception 'INVALID_AUTHORITY_REVIEW_SCOPE';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('requestId',r.id,'vehicleId',v.id,'contextRevision',public.provider_authority_context_revision(r,v),
  'vehicleLabel',concat_ws(' · ',nullif(trim(concat_ws(' ',v.make,v.model)),''),v.platform_number),
  'providerKind',case when v.organization_id is not null then 'ORGANIZATION' else 'PROVIDER_PROFILE' end,
  'providerId',coalesce(v.organization_id,v.provider_profile_id),'providerName',coalesce(o.name,p.business_name),
  'supportedFacts',case when not v.active or r.status<>'APPROVED' or r.expires_on<(now() at time zone 'Africa/Addis_Ababa')::date then '[]'::jsonb
   when r.subject_type='VEHICLE' and r.verification_type::text='VEHICLE_OWNERSHIP' then '["OWNERSHIP"]'::jsonb
   when r.subject_type='VEHICLE' and r.verification_type::text='VEHICLE_OPERATING_LICENSE' then '["OPERATING_LICENCE"]'::jsonb
   when r.verification_type::text='VEHICLE_AUTHORIZATION' and(r.subject_type='VEHICLE' or r.subject_type='PROVIDER_PROFILE' and r.subject_id=v.provider_profile_id) then '["PERMISSION"]'::jsonb else '[]'::jsonb end,
  'reviews',coalesce(history.records,'[]'::jsonb),'hasMoreHistory',coalesce(history.total,0)>20) order by r.id),'[]'::jsonb)
 from public.verification_requests r
 join public.vehicles v on v.id=case when r.subject_type='VEHICLE' then r.subject_id else r.related_vehicle_id end
 left join public.organizations o on o.id=v.organization_id left join public.provider_profiles p on p.id=v.provider_profile_id
 left join lateral(select jsonb_agg(jsonb_build_object('id',a.id,'factKind',a.fact_kind,'holderBasis',a.holder_basis,
  'expiresOn',a.expires_on,'reviewedAt',a.reviewed_at,'revokedAt',a.revoked_at,'current',exists(select 1 from public.current_provider_vehicle_authority() current_review where current_review.review_id=a.id),
  'reviewNote',a.review_note,'revocationReason',a.revocation_reason,
  'providerKind',case when a.organization_id is not null then 'ORGANIZATION' else 'PROVIDER_PROFILE' end,'providerId',coalesce(a.organization_id,a.provider_profile_id)) order by a.reviewed_at desc,a.id),max(a.total) as total
  from(select x.*,count(*) over() as total from public.provider_vehicle_authority_reviews x where x.source_request_id=r.id order by x.reviewed_at desc,x.id limit 20)a)history(records,total) on true
 where r.id=any(requested_request_ids));
end $$;
revoke all on function public.managed_provider_authority_review_context(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.managed_provider_authority_review_context(uuid,uuid[]) to service_role;

-- New licence uploads reuse the existing exact-truck/private-file command.
-- Comparisons remain TEXT until after the enum addition commits.
do $verification$
declare definition text;anchor text;replacement text;
begin
 definition:=pg_get_functiondef('public.managed_verification_center(uuid)'::regprocedure);
 anchor:='jsonb_build_array(''VEHICLE_OWNERSHIP'',''VEHICLE_AUTHORIZATION'')';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_VERIFICATION_CENTER_DRIFT';end if;
 definition:=replace(definition,anchor,'jsonb_build_array(''VEHICLE_OWNERSHIP'',''VEHICLE_AUTHORIZATION'',''VEHICLE_OPERATING_LICENSE'')');
 anchor:='''type'',''Fleet transporter''';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_OWNER_LABEL_DRIFT';end if;
 definition:=replace(definition,anchor,'''type'',''Transport Provider''');
 anchor:='''type'',case when application_type=''OWNER_OPERATOR'' then ''Owner-operator'' else ''Self-managed driver'' end';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_PERSONAL_LABEL_DRIFT';end if;
 definition:=replace(definition,anchor,'''type'',''Transport Provider''');
 anchor:=E'  -- Both evidence alternatives belong to a concrete current truck, regardless';
 replacement:=$new$  -- Personal provider owners manage employed drivers without impersonating them.
  if not scope.is_company_driver and scope.provider_profile_id is not null then
   for row_record in select driver.user_id,driver.name from public.drivers driver
    join public.profiles profile on profile.id=driver.user_id and profile.active and profile.role='DRIVER'
    where driver.provider_profile_id=scope.provider_profile_id and driver.active order by driver.name,driver.user_id
   loop
    select coalesce(jsonb_agg(jsonb_build_object('verification_type',request.verification_type,'reviewed_at',request.reviewed_at,
     'expires_on',request.expires_on,'related_vehicle_id',request.related_vehicle_id) order by request.reviewed_at desc nulls last,request.id),'[]'::jsonb)
    into approved from public.verification_requests request where request.subject_type='DRIVER' and request.subject_id=row_record.user_id and request.status='APPROVED';
    subjects:=subjects||jsonb_build_array(jsonb_build_object('subject_type','DRIVER','subject_id',row_record.user_id,'name',row_record.name,
     'type','Driver','verification_types',jsonb_build_array('IDENTITY','DRIVER_IDENTITY'),'vehicles','[]'::jsonb,'approved_documents',approved));
   end loop;
  end if;
  if scope.actor_role='TRANSPORTER' and public.managed_verification_controls_driver(actor_user_id,actor_user_id) then
   select coalesce(jsonb_agg(jsonb_build_object('verification_type',request.verification_type,'reviewed_at',request.reviewed_at,
    'expires_on',request.expires_on,'related_vehicle_id',request.related_vehicle_id) order by request.reviewed_at desc nulls last,request.id),'[]'::jsonb)
   into approved from public.verification_requests request where request.subject_type='DRIVER' and request.subject_id=actor_user_id and request.status='APPROVED';
   subjects:=subjects||jsonb_build_array(jsonb_build_object('subject_type','DRIVER','subject_id',actor_user_id,'name',actor.full_name,
    'type','Driver','verification_types',jsonb_build_array('IDENTITY','DRIVER_IDENTITY'),'vehicles','[]'::jsonb,'approved_documents',approved));
  end if;
  -- Both evidence alternatives belong to a concrete current truck, regardless$new$;
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_DRIVER_CENTER_DRIFT';end if;
 definition:=replace(definition,anchor,replacement);execute definition;
 definition:=pg_get_functiondef('public.submit_managed_verification(uuid,jsonb)'::regprocedure);
 anchor:='subject_type=''VEHICLE'' and verification_type in (''VEHICLE_OWNERSHIP'',''VEHICLE_AUTHORIZATION'')';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_VERIFICATION_SUBMIT_DRIFT';end if;
 definition:=replace(definition,anchor,'subject_type=''VEHICLE'' and verification_type in (''VEHICLE_OWNERSHIP'',''VEHICLE_AUTHORIZATION'',''VEHICLE_OPERATING_LICENSE'')');
 anchor:='if verification_type=''VEHICLE_AUTHORIZATION'' then';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_VERIFICATION_EXPIRY_DRIFT';end if;
 definition:=replace(definition,anchor,'if verification_type in (''VEHICLE_AUTHORIZATION'',''VEHICLE_OPERATING_LICENSE'') then');
 anchor:=$old$subject_type='DRIVER' and not(
      scope.is_company_driver and subject_id=actor_user_id
      or scope.actor_role='TRANSPORTER' and exists(select 1 from public.drivers driver where driver.user_id=subject_id and driver.organization_id=scope.organization_id and driver.active)
    )$old$;
 replacement:='subject_type=''DRIVER'' and not public.managed_verification_controls_driver(actor_user_id,subject_id)';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_DRIVER_SUBMIT_DRIFT';end if;
 definition:=replace(definition,anchor,replacement);
 anchor:='subject_type=''ORGANIZATION'' and not(scope.actor_role=''TRANSPORTER'' and scope.organization_id=subject_id)';
 replacement:='subject_type=''ORGANIZATION'' and not exists(select 1 from public.profiles p join public.organization_members m on m.user_id=p.id and m.membership_role=''OWNER'' where p.id=actor_user_id and p.active and p.role=''TRANSPORTER'' and m.organization_id=subject_id)';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_OWNER_ORG_SUBMIT_DRIFT';end if;
 definition:=replace(definition,anchor,replacement);
 anchor:='subject_type=''PROVIDER_PROFILE'' and scope.provider_profile_id is distinct from subject_id';
 replacement:='subject_type=''PROVIDER_PROFILE'' and not exists(select 1 from public.profiles p join public.provider_profiles owner_scope on owner_scope.user_id=p.id where p.id=actor_user_id and p.active and p.role=''DRIVER'' and owner_scope.id=subject_id)';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_OWNER_PROFILE_SUBMIT_DRIFT';end if;
 definition:=replace(definition,anchor,replacement);
 -- NR-48: terminal document approval is historical review, not current exact
 -- authority. Preserve its source/file while allowing new Pending evidence
 -- after revocation, expiry or changed truck/provider identity. The existing
 -- per-subject advisory lock still serializes simultaneous pending uploads.
 anchor:=$old$and request.status in ('PENDING','APPROVED') and (request.expires_on is null or request.expires_on>=current_date)$old$;
 replacement:=$new$and (request.status='PENDING' or request.status='APPROVED' and (
        subject_type<>'VEHICLE' or exists(select 1 from public.current_provider_vehicle_authority() current_fact
          where current_fact.vehicle_id=subject_id and current_fact.fact_kind=case verification_type
            when 'VEHICLE_OWNERSHIP' then 'OWNERSHIP' when 'VEHICLE_AUTHORIZATION' then 'PERMISSION'
            when 'VEHICLE_OPERATING_LICENSE' then 'OPERATING_LICENCE' end)))
      and (request.expires_on is null or request.expires_on>=current_date)$new$;
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'AUTHORITY_REPLACEMENT_SUBMIT_DRIFT';end if;
 definition:=replace(definition,anchor,replacement);
 execute definition;
end $verification$;

-- Search's ownership/permission filters must agree with reviewed relationships,
-- not an unrelated holder's generic approved document. Keep lazy scan guard.
do $search$
declare definition text;start_at integer;end_at integer;
begin
 definition:=pg_get_functiondef('public.capacity_search_metadata(jsonb)'::regprocedure);
 definition:=replace(definition,$old$and ((org is not null and r.subject_type='DRIVER' and r.subject_id=driver) or (provider is not null and r.subject_type='PROVIDER_PROFILE' and r.subject_id=provider));$old$,
 $new$and ((r.subject_type='DRIVER' and r.subject_id=driver) or (provider is not null and driver=(select p.user_id from public.provider_profiles p where p.id=provider) and r.subject_type='PROVIDER_PROFILE' and r.subject_id=provider));$new$);
 start_at:=strpos(definition,' select coalesce(jsonb_agg(distinct r.verification_type)');
 start_at:=strpos(substring(definition from start_at),'into truck_docs')+start_at-1;
 if start_at<1 then raise exception 'AUTHORITY_SEARCH_METADATA_DRIFT';end if;
 -- The exact truck-doc SELECT is replaced below using its complete base block.
 definition:=replace(definition,$old$ select coalesce(jsonb_agg(distinct r.verification_type),'[]') into truck_docs from verification_requests r
 where r.status='APPROVED' and (r.expires_on is null or r.expires_on>=today)
 and ((r.subject_type='VEHICLE' and r.subject_id=truck) or (r.verification_type='VEHICLE_AUTHORIZATION' and r.related_vehicle_id=truck
 and ((org is not null and r.subject_type='DRIVER' and r.subject_id=driver) or (provider is not null and r.subject_type='PROVIDER_PROFILE' and r.subject_id=provider))));$old$,
 $new$ select coalesce(jsonb_agg(distinct case a.fact_kind when 'OWNERSHIP' then 'VEHICLE_OWNERSHIP' when 'PERMISSION' then 'VEHICLE_AUTHORIZATION' when 'OPERATING_LICENCE' then 'VEHICLE_OPERATING_LICENSE' end),'[]'::jsonb)
 into truck_docs from public.current_provider_vehicle_authority() a where a.vehicle_id=truck and a.fact_kind in('OWNERSHIP','PERMISSION','OPERATING_LICENCE');$new$);
 if strpos(definition,'into truck_docs from public.current_provider_vehicle_authority()')=0 then raise exception 'AUTHORITY_SEARCH_DOCUMENT_ANCHOR_DRIFT';end if;
 execute definition;
end $search$;

update public.provider_authority_function_backups b set candidate_md5=md5(pg_get_functiondef(to_regprocedure(b.signature)));
notify pgrst,'reload schema';
commit;
