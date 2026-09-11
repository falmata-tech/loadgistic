-- BASE-DEP-001 / FEAT-SHR-001
-- Serialize Shared capacity issuance, keep short-lived credentials out of stale
-- delivery leases, and remove terminal guest-access records after a bounded
-- retention window.

create index if not exists shared_capacity_email_otps_retention_idx
  on public.shared_capacity_email_otps(expires_at,id);

create index if not exists access_email_deliveries_shared_retention_idx
  on public.access_email_deliveries(updated_at,id)
  where delivery_kind='SHARED_CAPACITY';

-- A row lock cannot serialize the first challenge for a recipient because that
-- row does not exist yet. Use a transaction-scoped advisory lock derived from
-- the non-reversible recipient digest so concurrent issuers supersede and
-- insert in one deterministic sequence. Hash collisions only serialize two
-- unrelated recipients; they cannot broaden access.
create or replace function public.request_shared_capacity_otp(
  challenge_id uuid,
  normalized_recipient_email text,
  recipient_digest text,
  challenge_code_digest text,
  challenge_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  eligible boolean;
begin
  if recipient_digest !~ '^[a-f0-9]{64}$' or challenge_code_digest='' then
    raise exception 'INVALID_OTP_REQUEST';
  end if;
  if challenge_expires_at<=clock_timestamp()
    or challenge_expires_at>clock_timestamp()+interval '10 minutes 5 seconds' then
    raise exception 'INVALID_OTP_EXPIRY';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(recipient_digest,0)
  );

  select exists(
    select 1 from public.capacity_access_grants grant_record
    where grant_record.audience_type='EMAIL'
      and grant_record.recipient_email_digest=recipient_digest
      and grant_record.revoked_at is null
      and (grant_record.expires_at is null or grant_record.expires_at>clock_timestamp())
  ) into eligible;
  if not eligible then return false; end if;

  update public.shared_capacity_email_otps
  set superseded_at=clock_timestamp()
  where recipient_email_digest=recipient_digest
    and used_at is null
    and superseded_at is null
    and expires_at>clock_timestamp();

  insert into public.shared_capacity_email_otps(
    id,recipient_email,recipient_email_digest,code_digest,
    attempt_count,expires_at,created_at
  ) values(
    challenge_id,lower(trim(normalized_recipient_email)),recipient_digest,
    challenge_code_digest,0,challenge_expires_at,clock_timestamp()
  );
  insert into public.access_email_deliveries(
    id,delivery_kind,entity_id,recipient_email,status,attempts,created_at,updated_at
  ) values(
    gen_random_uuid(),'SHARED_CAPACITY',challenge_id,
    lower(trim(normalized_recipient_email)),'QUEUED',0,clock_timestamp(),clock_timestamp()
  );
  insert into public.audit_logs(id,action,entity_type,entity_id,details)
  values(
    gen_random_uuid(),'SHARED_CAPACITY_OTP_REQUESTED',
    'shared_capacity_email_otp',challenge_id,
    jsonb_build_object('eligible',true)
  );
  return true;
end;
$$;

create or replace function public.pending_access_email_deliveries(requested_limit integer default 20)
returns table(payload jsonb)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  return query
    with candidates as (
      select delivery.id
      from public.access_email_deliveries delivery
      where delivery.status in ('QUEUED','FAILED')
        and (delivery.next_attempt_at is null or delivery.next_attempt_at<=clock_timestamp())
        and delivery.attempts<6
        and (
          delivery.delivery_kind='GUEST_SUPPORT'
          or delivery.delivery_kind='SHARED_CAPACITY' and exists(
            select 1
            from public.shared_capacity_email_otps challenge
            where challenge.id=delivery.entity_id
              and challenge.used_at is null
              and challenge.superseded_at is null
              and challenge.expires_at>clock_timestamp()
              and challenge.attempt_count<5
          )
        )
      order by delivery.created_at,delivery.id
      for update skip locked
      limit greatest(1,least(coalesce(requested_limit,20),100))
    ), claimed as (
      update public.access_email_deliveries delivery
      set next_attempt_at=clock_timestamp()+interval '10 minutes',updated_at=clock_timestamp()
      from candidates where delivery.id=candidates.id
      returning delivery.*
    )
    select to_jsonb(claimed)||jsonb_build_object('challenge_expires_at',challenge.expires_at)
    from claimed
    left join public.shared_capacity_email_otps challenge
      on claimed.delivery_kind='SHARED_CAPACITY' and challenge.id=claimed.entity_id
    order by claimed.created_at,claimed.id;
end
$$;

create or replace function public.shared_capacity_delivery_is_deliverable(delivery_id uuid)
returns boolean
language sql
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1
    from public.access_email_deliveries delivery
    join public.shared_capacity_email_otps challenge on challenge.id=delivery.entity_id
    where delivery.id=delivery_id
      and delivery.delivery_kind='SHARED_CAPACITY'
      and delivery.status in ('QUEUED','FAILED')
      and delivery.attempts<6
      and challenge.used_at is null
      and challenge.superseded_at is null
      and challenge.expires_at>clock_timestamp()
      and challenge.attempt_count<5
  )
$$;

create or replace function public.shared_capacity_access_cleanup(requested_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  bounded_limit integer:=greatest(1,least(coalesce(requested_limit,100),500));
  cutoff_at timestamptz:=clock_timestamp()-interval '24 hours';
  challenge_ids uuid[];
  challenge_count integer:=0;
  linked_delivery_count integer:=0;
  stale_delivery_count integer:=0;
  remaining_delivery_limit integer;
begin
  select coalesce(array_agg(candidate.id),'{}'::uuid[]) into challenge_ids
  from (
    select challenge.id
    from public.shared_capacity_email_otps challenge
    where least(
      challenge.expires_at,
      coalesce(challenge.used_at,'infinity'::timestamptz),
      coalesce(challenge.superseded_at,'infinity'::timestamptz)
    )<=cutoff_at
    order by least(
      challenge.expires_at,
      coalesce(challenge.used_at,'infinity'::timestamptz),
      coalesce(challenge.superseded_at,'infinity'::timestamptz)
    ),challenge.id
    for update skip locked
    limit bounded_limit
  ) candidate;

  if cardinality(challenge_ids)>0 then
    delete from public.access_email_deliveries delivery
    where delivery.delivery_kind='SHARED_CAPACITY' and delivery.entity_id=any(challenge_ids);
    get diagnostics linked_delivery_count=row_count;

    delete from public.shared_capacity_email_otps challenge
    where challenge.id=any(challenge_ids);
    get diagnostics challenge_count=row_count;
  end if;

  remaining_delivery_limit:=greatest(0,bounded_limit-linked_delivery_count);
  if remaining_delivery_limit>0 then
    with candidates as (
      select delivery.id
      from public.access_email_deliveries delivery
      where delivery.delivery_kind='SHARED_CAPACITY'
        and (
          not exists(
            select 1 from public.shared_capacity_email_otps challenge
            where challenge.id=delivery.entity_id
          ) and delivery.created_at<=cutoff_at
          or delivery.updated_at<=cutoff_at and (
            delivery.status='SENT'
            or delivery.status='FAILED' and delivery.attempts>=6
          )
        )
      order by delivery.updated_at,delivery.id
      for update skip locked
      limit remaining_delivery_limit
    )
    delete from public.access_email_deliveries delivery
    using candidates where delivery.id=candidates.id;
    get diagnostics stale_delivery_count=row_count;
  end if;

  return jsonb_build_object(
    'otpCount',challenge_count,
    'deliveryCount',linked_delivery_count+stale_delivery_count
  );
end
$$;

revoke all on function public.pending_access_email_deliveries(integer) from public,anon,authenticated;
revoke all on function public.request_shared_capacity_otp(uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.shared_capacity_delivery_is_deliverable(uuid) from public,anon,authenticated;
revoke all on function public.shared_capacity_access_cleanup(integer) from public,anon,authenticated;

grant execute on function public.pending_access_email_deliveries(integer) to service_role;
grant execute on function public.request_shared_capacity_otp(uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.shared_capacity_delivery_is_deliverable(uuid) to service_role;
grant execute on function public.shared_capacity_access_cleanup(integer) to service_role;

comment on function public.pending_access_email_deliveries(integer) is
  'Leases a bounded access-email batch while excluding terminal Shared capacity challenges.';
comment on function public.request_shared_capacity_otp(uuid,text,text,text,timestamptz) is
  'Serializes one recipient digest so concurrent requests leave only the newest Shared capacity challenge deliverable.';
comment on function public.shared_capacity_delivery_is_deliverable(uuid) is
  'Rechecks one leased Shared capacity delivery immediately before provider submission.';
comment on function public.shared_capacity_access_cleanup(integer) is
  'Deletes bounded Shared capacity challenge and delivery records after 24 hours and returns safe counts only.';
