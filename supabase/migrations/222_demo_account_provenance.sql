-- FEAT-SIM-001. Read-only account provenance on the existing bounded owner batch.
-- This label grants no simulator authority. Worker writes retain their exact
-- cohort, current actor/assignment, source, lease and enabled-control checks.
begin;
select pg_advisory_xact_lock(8030222);
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.capacity_owner_documents(organization_ids uuid[],provider_ids uuid[])
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,pg_temp as $$
declare result jsonb;
begin
  if coalesce(cardinality(organization_ids),0)+coalesce(cardinality(provider_ids),0)>100 then
    raise exception 'INVALID_PAGE_SIZE';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('subject_type',owner.subject_type,'subject_id',owner.subject_id,
    'documents',coalesce(documents.records,'[]'::jsonb),
    'account_is_demo',case owner.subject_type
      when 'ORGANIZATION' then
        exists(select 1 from public.organization_members member
          where member.organization_id=owner.subject_id and member.membership_role='OWNER')
        and not exists(select 1 from public.organization_members member
          where member.organization_id=owner.subject_id and member.membership_role='OWNER'
          and not exists(select 1 from public.profiles profile join auth.users identity on identity.id=profile.id
            where profile.id=member.user_id and profile.active and identity.deleted_at is null
              and identity.raw_app_meta_data->>'fixture_source'='loadgistic'))
      when 'PROVIDER_PROFILE' then exists(
        select 1 from public.provider_profiles provider
        join public.profiles profile on profile.id=provider.user_id and profile.active
        join auth.users identity on identity.id=profile.id and identity.deleted_at is null
        where provider.id=owner.subject_id and identity.raw_app_meta_data->>'fixture_source'='loadgistic')
      else false end)),'[]'::jsonb) into result
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
commit;
