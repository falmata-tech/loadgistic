-- BASE-DEP-001 / FEAT-SHR-001
-- Lease-owned targeted Shared capacity delivery, short challenge-aware retries,
-- and bounded terminal Assisted matching email metadata.

alter table public.access_email_deliveries
  add column if not exists lease_token uuid,
  add column if not exists leased_until timestamptz;

create index if not exists access_email_deliveries_pending_due_idx
  on public.access_email_deliveries(
    ((case when delivery_kind='SHARED_CAPACITY' then 0 else 1 end)),
    (coalesce(next_attempt_at,created_at)),
    (coalesce(leased_until,'-infinity'::timestamptz)),
    created_at,
    id
  )
  where status in ('QUEUED','FAILED') and attempts<6;

create index if not exists access_email_deliveries_guest_terminal_idx
  on public.access_email_deliveries(updated_at,id)
  where delivery_kind='GUEST_SUPPORT'
    and (status='SENT' or (status='FAILED' and attempts>=6));

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
      left join public.shared_capacity_email_otps challenge
        on delivery.delivery_kind='SHARED_CAPACITY' and challenge.id=delivery.entity_id
      where delivery.status in ('QUEUED','FAILED')
        and coalesce(delivery.next_attempt_at,delivery.created_at)<=clock_timestamp()
        and coalesce(delivery.leased_until,'-infinity'::timestamptz)<=clock_timestamp()
        and delivery.attempts<6
        and (
          delivery.delivery_kind='GUEST_SUPPORT'
          or delivery.delivery_kind='SHARED_CAPACITY'
            and challenge.used_at is null
            and challenge.superseded_at is null
            and challenge.expires_at>clock_timestamp()+interval '30 seconds'
            and challenge.attempt_count<5
        )
      order by case when delivery.delivery_kind='SHARED_CAPACITY' then 0 else 1 end,
        coalesce(delivery.next_attempt_at,delivery.created_at),delivery.created_at,delivery.id
      for update of delivery skip locked
      -- Keep the compatibility parameter but never age more than one lease
      -- while a serial worker performs provider I/O.
      limit 1
    ), claimed as (
      update public.access_email_deliveries delivery
      set lease_token=gen_random_uuid(),
        leased_until=clock_timestamp()+interval '90 seconds',
        updated_at=clock_timestamp()
      from candidates where delivery.id=candidates.id
      returning delivery.*
    )
    select to_jsonb(claimed)||jsonb_build_object('challenge_expires_at',challenge.expires_at)
    from claimed
    left join public.shared_capacity_email_otps challenge
      on claimed.delivery_kind='SHARED_CAPACITY' and challenge.id=claimed.entity_id
    order by case when claimed.delivery_kind='SHARED_CAPACITY' then 0 else 1 end,
      coalesce(claimed.next_attempt_at,claimed.created_at),claimed.created_at,claimed.id;
end
$$;

create or replace function public.claim_access_email_delivery(
  requested_kind text,
  requested_entity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  claimed_payload jsonb;
begin
  if requested_kind not in ('SHARED_CAPACITY','GUEST_SUPPORT') then
    raise exception 'INVALID_ACCESS_DELIVERY_KIND';
  end if;

  with candidate as (
    select delivery.id
    from public.access_email_deliveries delivery
    left join public.shared_capacity_email_otps challenge
      on delivery.delivery_kind='SHARED_CAPACITY' and challenge.id=delivery.entity_id
    where delivery.delivery_kind=requested_kind
      and delivery.entity_id=requested_entity_id
      and delivery.status in ('QUEUED','FAILED')
      and coalesce(delivery.next_attempt_at,delivery.created_at)<=clock_timestamp()
      and coalesce(delivery.leased_until,'-infinity'::timestamptz)<=clock_timestamp()
      and delivery.attempts<6
      and (
        delivery.delivery_kind='GUEST_SUPPORT'
        or delivery.delivery_kind='SHARED_CAPACITY'
          and challenge.used_at is null
          and challenge.superseded_at is null
          and challenge.expires_at>clock_timestamp()+interval '30 seconds'
          and challenge.attempt_count<5
      )
    for update of delivery skip locked
  ), claimed as (
    update public.access_email_deliveries delivery
    set lease_token=gen_random_uuid(),
      leased_until=clock_timestamp()+interval '90 seconds',
      updated_at=clock_timestamp()
    from candidate where delivery.id=candidate.id
    returning delivery.*
  )
  select to_jsonb(claimed)||jsonb_build_object('challenge_expires_at',challenge.expires_at)
  into claimed_payload
  from claimed
  left join public.shared_capacity_email_otps challenge
    on claimed.delivery_kind='SHARED_CAPACITY' and challenge.id=claimed.entity_id;

  return claimed_payload;
end
$$;

create or replace function public.access_email_delivery_is_deliverable(
  delivery_id uuid,
  claimed_lease_token uuid
)
returns boolean
language sql
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1
    from public.access_email_deliveries delivery
    left join public.shared_capacity_email_otps challenge
      on delivery.delivery_kind='SHARED_CAPACITY' and challenge.id=delivery.entity_id
    where delivery.id=delivery_id
      and delivery.status in ('QUEUED','FAILED')
      and delivery.attempts<6
      and delivery.lease_token=claimed_lease_token
      and delivery.leased_until>clock_timestamp()
      and (
        delivery.delivery_kind='GUEST_SUPPORT'
        or delivery.delivery_kind='SHARED_CAPACITY'
          and challenge.used_at is null
          and challenge.superseded_at is null
          and challenge.expires_at>clock_timestamp()+interval '30 seconds'
          and challenge.attempt_count<5
      )
  )
$$;

create or replace function public.shared_capacity_delivery_is_deliverable(
  delivery_id uuid,
  claimed_lease_token uuid
)
returns boolean
language sql
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1 from public.access_email_deliveries delivery
    where delivery.id=delivery_id
      and delivery.delivery_kind='SHARED_CAPACITY'
      and public.access_email_delivery_is_deliverable(delivery_id,claimed_lease_token)
  )
$$;

create or replace function public.record_access_email_delivery_attempt(
  delivery_id uuid,
  claimed_lease_token uuid,
  was_sent boolean,
  failure_message text default null
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  delivery public.access_email_deliveries%rowtype;
  challenge_expires_at timestamptz;
  next_attempt_count integer;
  retry_at timestamptz;
begin
  select * into delivery from public.access_email_deliveries where id=delivery_id for update;
  if not found then return false; end if;
  if delivery.status='SENT' then return true; end if;
  if delivery.lease_token is distinct from claimed_lease_token
    or delivery.leased_until is null
    or delivery.leased_until<=clock_timestamp() then
    return false;
  end if;

  next_attempt_count:=delivery.attempts+1;
  if not was_sent and delivery.delivery_kind='SHARED_CAPACITY' then
    select challenge.expires_at into challenge_expires_at
    from public.shared_capacity_email_otps challenge where challenge.id=delivery.entity_id;
    retry_at:=clock_timestamp()+make_interval(
      secs=>least(120,(15*power(2,greatest(0,next_attempt_count-1)))::integer)
    );
    if next_attempt_count>=6
      or challenge_expires_at is null
      or retry_at>=challenge_expires_at-interval '30 seconds' then
      next_attempt_count:=6;
      retry_at:=null;
    end if;
  elsif not was_sent then
    retry_at:=clock_timestamp()+(least(24,power(2,next_attempt_count))::text||' hours')::interval;
  end if;

  update public.access_email_deliveries set
    status=case when was_sent then 'SENT' else 'FAILED' end,
    attempts=next_attempt_count,
    last_error=case when was_sent then null else left(coalesce(failure_message,'DELIVERY_FAILED'),500) end,
    next_attempt_at=case when was_sent then null else retry_at end,
    sent_at=case when was_sent then clock_timestamp() else null end,
    lease_token=null,
    leased_until=null,
    updated_at=clock_timestamp()
  where id=delivery.id;
  return true;
end;
$$;

create or replace function public.shared_capacity_access_cleanup(requested_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  bounded_limit integer:=greatest(1,least(coalesce(requested_limit,100),500));
  shared_cutoff_at timestamptz:=clock_timestamp()-interval '24 hours';
  guest_cutoff_at timestamptz:=clock_timestamp()-interval '30 days';
  challenge_ids uuid[];
  challenge_count integer:=0;
  linked_delivery_count integer:=0;
  stale_delivery_count integer:=0;
  guest_delivery_count integer:=0;
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
    )<=shared_cutoff_at
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
          ) and delivery.created_at<=shared_cutoff_at
          or delivery.updated_at<=shared_cutoff_at and (
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

  remaining_delivery_limit:=greatest(
    0,bounded_limit-linked_delivery_count-stale_delivery_count
  );
  if remaining_delivery_limit>0 then
    with candidates as (
      select delivery.id
      from public.access_email_deliveries delivery
      where delivery.delivery_kind='GUEST_SUPPORT'
        and delivery.updated_at<=guest_cutoff_at
        and (
          delivery.status='SENT'
          or delivery.status='FAILED' and delivery.attempts>=6
        )
      order by delivery.updated_at,delivery.id
      for update skip locked
      limit remaining_delivery_limit
    )
    delete from public.access_email_deliveries delivery
    using candidates where delivery.id=candidates.id;
    get diagnostics guest_delivery_count=row_count;
  end if;

  return jsonb_build_object(
    'otpCount',challenge_count,
    'deliveryCount',linked_delivery_count+stale_delivery_count+guest_delivery_count,
    'guestDeliveryCount',guest_delivery_count
  );
end
$$;

revoke all on function public.pending_access_email_deliveries(integer) from public,anon,authenticated;
revoke all on function public.claim_access_email_delivery(text,uuid) from public,anon,authenticated;
revoke all on function public.access_email_delivery_is_deliverable(uuid,uuid) from public,anon,authenticated;
revoke all on function public.shared_capacity_delivery_is_deliverable(uuid,uuid) from public,anon,authenticated;
revoke all on function public.record_access_email_delivery_attempt(uuid,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.shared_capacity_access_cleanup(integer) from public,anon,authenticated;

-- Superseded non-lease-aware overloads remain unavailable during the additive
-- compatibility window.
revoke all on function public.shared_capacity_delivery_is_deliverable(uuid) from public,anon,authenticated,service_role;
revoke all on function public.record_access_email_delivery_attempt(uuid,boolean,text) from public,anon,authenticated,service_role;

grant execute on function public.pending_access_email_deliveries(integer) to service_role;
grant execute on function public.claim_access_email_delivery(text,uuid) to service_role;
grant execute on function public.access_email_delivery_is_deliverable(uuid,uuid) to service_role;
grant execute on function public.shared_capacity_delivery_is_deliverable(uuid,uuid) to service_role;
grant execute on function public.record_access_email_delivery_attempt(uuid,uuid,boolean,text) to service_role;
grant execute on function public.shared_capacity_access_cleanup(integer) to service_role;

comment on function public.pending_access_email_deliveries(integer) is
  'Lease-owns one due access-email row immediately before provider I/O while excluding terminal Shared capacity challenges.';
comment on function public.claim_access_email_delivery(text,uuid) is
  'Lease-owns only one requested access-email target and returns no row when it is absent or ineligible.';
comment on function public.access_email_delivery_is_deliverable(uuid,uuid) is
  'Fences both access-email kinds by live lease and requires a usable Shared capacity challenge immediately before provider submission.';
comment on function public.shared_capacity_delivery_is_deliverable(uuid,uuid) is
  'Compatibility wrapper for the lease-fenced Shared capacity delivery check.';
comment on function public.record_access_email_delivery_attempt(uuid,uuid,boolean,text) is
  'Records only the active lease owner and keeps Shared capacity retry delay inside challenge validity.';
comment on function public.shared_capacity_access_cleanup(integer) is
  'Deletes bounded Shared challenge metadata after 24 hours and terminal support-email metadata after 30 days.';
