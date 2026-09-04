-- BASE-BE-001 / BASE-DEP-001 / FEAT-TRK-001
-- Shipment-scoped Tracking recipients and application-owned email OTP access.
-- Browser roles retain default-deny RLS; every command is service-role-only and
-- PostgreSQL repeats shipment ownership or guest-recipient authorization.

create table if not exists public.provider_tracking_recipients (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.provider_shipments(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('OWNER','TRACKING_PARTY')),
  recipient_email text not null,
  recipient_email_digest text not null check (recipient_email_digest ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id)
);

create unique index if not exists provider_tracking_recipients_active_email_idx
  on public.provider_tracking_recipients(shipment_id,recipient_email_digest)
  where revoked_at is null;
create unique index if not exists provider_tracking_recipients_owner_idx
  on public.provider_tracking_recipients(shipment_id)
  where recipient_role='OWNER';
create index if not exists provider_tracking_recipients_lookup_idx
  on public.provider_tracking_recipients(recipient_email_digest,shipment_id,revoked_at);

create table if not exists public.provider_tracking_email_otps (
  id uuid primary key,
  shipment_id uuid not null references public.provider_shipments(id) on delete cascade,
  recipient_id uuid not null references public.provider_tracking_recipients(id) on delete cascade,
  recipient_email_digest text not null check (recipient_email_digest ~ '^[a-f0-9]{64}$'),
  code_digest text not null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  expires_at timestamptz not null,
  used_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists provider_tracking_email_otps_recipient_idx
  on public.provider_tracking_email_otps(recipient_id,created_at desc);
create index if not exists provider_tracking_email_otps_retention_idx
  on public.provider_tracking_email_otps(expires_at,id);

alter table public.provider_tracking_recipients enable row level security;
alter table public.provider_tracking_email_otps enable row level security;

comment on table public.provider_tracking_recipients is
  'Private shipment-scoped Tracking parties. Emails are visible only to the owning provider; browser clients have no direct policy.';
comment on table public.provider_tracking_email_otps is
  'Single-use application OTP challenges for exact Tracking recipient and shipment-code matches. Plaintext codes are never persisted.';

alter table public.access_email_deliveries
  drop constraint if exists access_email_deliveries_delivery_kind_check;
alter table public.access_email_deliveries
  add constraint access_email_deliveries_delivery_kind_check
  check (delivery_kind in ('SHARED_CAPACITY','GUEST_SUPPORT','TRACKING_OTP'));

drop index if exists public.access_email_deliveries_pending_due_idx;
create index access_email_deliveries_pending_due_idx
  on public.access_email_deliveries(
    ((case when delivery_kind in ('SHARED_CAPACITY','TRACKING_OTP') then 0 else 1 end)),
    (coalesce(next_attempt_at,created_at)),
    (coalesce(leased_until,'-infinity'::timestamptz)),
    created_at,
    id
  )
  where status in ('QUEUED','FAILED') and attempts<6;

create or replace function public.create_provider_tracking_with_recipients(
  actor_user_id uuid,
  command jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  created jsonb;
  shipment_id uuid;
  owner_email text:=lower(trim(coalesce(command->>'customer_email','')));
  owner_digest text:=trim(coalesce(command->>'customer_email_digest',''));
  recipient_value jsonb;
  recipient_email text;
  recipient_digest text;
  recipient_id uuid;
  additional jsonb:=coalesce(command->'additional_recipients','[]'::jsonb);
  timestamp_value timestamptz:=clock_timestamp();
begin
  if owner_digest !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_EMAIL'; end if;
  if jsonb_typeof(additional)<>'array' or jsonb_array_length(additional)>20 then
    raise exception 'INVALID_TRACKING_RECIPIENTS';
  end if;

  for recipient_value in select value from jsonb_array_elements(additional) loop
    recipient_email:=lower(trim(coalesce(recipient_value->>'email','')));
    recipient_digest:=trim(coalesce(recipient_value->>'digest',''));
    if recipient_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      or length(recipient_email)>254 or recipient_digest!~'^[a-f0-9]{64}$' then
      raise exception 'INVALID_EMAIL';
    end if;
  end loop;

  created:=public.create_provider_tracking(actor_user_id,command);
  shipment_id:=(created->>'id')::uuid;

  insert into public.provider_tracking_recipients(
    id,shipment_id,recipient_role,recipient_email,recipient_email_digest,
    created_by,created_at
  ) values(
    gen_random_uuid(),shipment_id,'OWNER',owner_email,owner_digest,
    actor_user_id,timestamp_value
  );

  for recipient_value in select value from jsonb_array_elements(additional) loop
    recipient_email:=lower(trim(recipient_value->>'email'));
    recipient_digest:=trim(recipient_value->>'digest');
    if recipient_digest=owner_digest then continue; end if;
    recipient_id:=null;
    insert into public.provider_tracking_recipients(
      id,shipment_id,recipient_role,recipient_email,recipient_email_digest,
      created_by,created_at
    ) values(
      gen_random_uuid(),shipment_id,'TRACKING_PARTY',recipient_email,recipient_digest,
      actor_user_id,timestamp_value
    ) on conflict do nothing returning id into recipient_id;
    if recipient_id is null then continue; end if;

    insert into public.email_deliveries(
      id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status,
      attempts,last_error,next_attempt_at,sent_at,created_at,updated_at
    ) values(
      gen_random_uuid(),shipment_id,'RECEIVER','TRACKING_ACCESS',recipient_email,
      'tracking-access:'||shipment_id::text||':'||recipient_id::text,
      'PENDING',0,null,timestamp_value,null,timestamp_value,timestamp_value
    );
    insert into public.audit_logs(
      id,actor_user_id,action,entity_type,entity_id,details,created_at
    ) values(
      gen_random_uuid(),actor_user_id,'TRACKING_RECIPIENT_ADDED',
      'provider_tracking_recipient',recipient_id,
      jsonb_build_object('shipmentId',shipment_id,'recipientRole','TRACKING_PARTY'),timestamp_value
    );
  end loop;
  return created;
end;
$$;

create or replace function public.list_provider_tracking_recipients(
  actor_user_id uuid,
  target_shipment_id uuid
)
returns table(payload jsonb)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if not public.provider_tracking_actor_owns_shipment(actor_user_id,target_shipment_id) then
    raise exception 'NOT_FOUND';
  end if;
  return query
    select jsonb_build_object(
      'id',recipient.id,
      'recipient_role',recipient.recipient_role,
      'recipient_email',recipient.recipient_email,
      'created_at',recipient.created_at,
      'revoked_at',recipient.revoked_at
    )
    from public.provider_tracking_recipients recipient
    where recipient.shipment_id=target_shipment_id
    order by case when recipient.recipient_role='OWNER' then 0 else 1 end,
      case when recipient.revoked_at is null then 0 else 1 end,
      recipient.created_at,recipient.id;
end;
$$;

create or replace function public.add_provider_tracking_recipient(
  actor_user_id uuid,
  target_shipment_id uuid,
  normalized_recipient_email text,
  recipient_digest text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  shipment public.provider_shipments%rowtype;
  recipient_id uuid:=gen_random_uuid();
  clean_email text:=lower(trim(normalized_recipient_email));
  timestamp_value timestamptz:=clock_timestamp();
begin
  if clean_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(clean_email)>254 or recipient_digest!~'^[a-f0-9]{64}$' then
    raise exception 'INVALID_EMAIL';
  end if;
  if not public.provider_tracking_actor_owns_shipment(actor_user_id,target_shipment_id) then
    raise exception 'NOT_FOUND';
  end if;
  select * into shipment from public.provider_shipments
  where id=target_shipment_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if shipment.operational_status='COMPLETED'
    or shipment.guest_expires_at is not null and shipment.guest_expires_at<=timestamp_value then
    raise exception 'TRACKING_RECIPIENTS_CLOSED';
  end if;
  if exists(
    select 1 from public.provider_tracking_recipients recipient
    where recipient.shipment_id=target_shipment_id
      and recipient.recipient_email_digest=recipient_digest
      and recipient.revoked_at is null
  ) then raise exception 'TRACKING_RECIPIENT_EXISTS'; end if;
  if (
    select count(*) from public.provider_tracking_recipients recipient
    where recipient.shipment_id=target_shipment_id and recipient.revoked_at is null
  )>=21 then raise exception 'TRACKING_RECIPIENT_LIMIT'; end if;

  insert into public.provider_tracking_recipients(
    id,shipment_id,recipient_role,recipient_email,recipient_email_digest,created_by,created_at
  ) values(
    recipient_id,target_shipment_id,'TRACKING_PARTY',clean_email,recipient_digest,actor_user_id,timestamp_value
  );
  insert into public.email_deliveries(
    id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status,
    attempts,last_error,next_attempt_at,sent_at,created_at,updated_at
  ) values(
    gen_random_uuid(),target_shipment_id,'RECEIVER','TRACKING_ACCESS',clean_email,
    'tracking-access:'||target_shipment_id::text||':'||recipient_id::text,
    'PENDING',0,null,timestamp_value,null,timestamp_value,timestamp_value
  );
  insert into public.audit_logs(
    id,actor_user_id,action,entity_type,entity_id,details,created_at
  ) values(
    gen_random_uuid(),actor_user_id,'TRACKING_RECIPIENT_ADDED','provider_tracking_recipient',recipient_id,
    jsonb_build_object('shipmentId',target_shipment_id,'recipientRole','TRACKING_PARTY'),timestamp_value
  );
  return jsonb_build_object(
    'id',recipient_id,'recipient_role','TRACKING_PARTY',
    'recipient_email',clean_email,'created_at',timestamp_value,'revoked_at',null
  );
end;
$$;

create or replace function public.revoke_provider_tracking_recipient(
  actor_user_id uuid,
  target_shipment_id uuid,
  target_recipient_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  recipient public.provider_tracking_recipients%rowtype;
  timestamp_value timestamptz:=clock_timestamp();
begin
  if not public.provider_tracking_actor_owns_shipment(actor_user_id,target_shipment_id) then
    raise exception 'NOT_FOUND';
  end if;
  select * into recipient from public.provider_tracking_recipients
  where id=target_recipient_id and shipment_id=target_shipment_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if recipient.recipient_role='OWNER' then raise exception 'TRACKING_OWNER_RECIPIENT_REQUIRED'; end if;
  if recipient.revoked_at is not null then return false; end if;

  update public.provider_tracking_recipients
  set revoked_at=timestamp_value,revoked_by=actor_user_id
  where id=recipient.id;
  update public.provider_tracking_email_otps
  set superseded_at=timestamp_value
  where recipient_id=recipient.id and used_at is null and superseded_at is null;
  insert into public.audit_logs(
    id,actor_user_id,action,entity_type,entity_id,details,created_at
  ) values(
    gen_random_uuid(),actor_user_id,'TRACKING_RECIPIENT_REVOKED','provider_tracking_recipient',recipient.id,
    jsonb_build_object('shipmentId',target_shipment_id),timestamp_value
  );
  return true;
end;
$$;

create or replace function public.request_provider_tracking_otp(
  challenge_id uuid,
  normalized_recipient_email text,
  recipient_digest text,
  tracking_code_digest text,
  challenge_code_digest text,
  challenge_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  recipient record;
  clean_email text:=lower(trim(normalized_recipient_email));
  timestamp_value timestamptz:=clock_timestamp();
begin
  if clean_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(clean_email)>254
    or recipient_digest!~'^[a-f0-9]{64}$'
    or length(trim(tracking_code_digest))<32
    or trim(challenge_code_digest)='' then
    raise exception 'INVALID_TRACKING_OTP_REQUEST';
  end if;
  if challenge_expires_at<=timestamp_value
    or challenge_expires_at>timestamp_value+interval '10 minutes 5 seconds' then
    raise exception 'INVALID_TRACKING_OTP_EXPIRY';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(recipient_digest||':'||tracking_code_digest,0)
  );
  select party.id as recipient_id,party.shipment_id
  into recipient
  from public.provider_tracking_recipients party
  join public.provider_shipments shipment on shipment.id=party.shipment_id
  join public.shipment_party_grants grant_record
    on grant_record.shipment_id=shipment.id and grant_record.party_role='SHIPPER'
  where party.recipient_email_digest=recipient_digest
    and party.recipient_email=clean_email
    and party.revoked_at is null
    and grant_record.code_hash=trim(tracking_code_digest)
    and grant_record.revoked_at is null
    and (grant_record.expires_at is null or grant_record.expires_at>timestamp_value)
    and (shipment.guest_expires_at is null or shipment.guest_expires_at>timestamp_value)
  order by party.created_at desc,party.id
  limit 1
  for update of party;
  if not found then
    insert into public.audit_logs(id,action,entity_type,details,created_at)
    values(gen_random_uuid(),'TRACKING_UNLOCK_DENIED','provider_tracking_access',
      jsonb_build_object('eligible',false),timestamp_value);
    return false;
  end if;

  update public.provider_tracking_email_otps
  set superseded_at=timestamp_value
  where recipient_id=recipient.recipient_id
    and used_at is null and superseded_at is null and expires_at>timestamp_value;
  insert into public.provider_tracking_email_otps(
    id,shipment_id,recipient_id,recipient_email_digest,code_digest,
    attempt_count,expires_at,created_at
  ) values(
    challenge_id,recipient.shipment_id,recipient.recipient_id,recipient_digest,
    challenge_code_digest,0,challenge_expires_at,timestamp_value
  );
  insert into public.access_email_deliveries(
    id,delivery_kind,entity_id,recipient_email,status,attempts,created_at,updated_at
  ) values(
    gen_random_uuid(),'TRACKING_OTP',challenge_id,clean_email,
    'QUEUED',0,timestamp_value,timestamp_value
  );
  insert into public.audit_logs(id,action,entity_type,entity_id,details,created_at)
  values(
    gen_random_uuid(),'TRACKING_OTP_REQUESTED','provider_tracking_email_otp',challenge_id,
    jsonb_build_object('shipmentId',recipient.shipment_id,'eligible',true),timestamp_value
  );
  return true;
end;
$$;

create or replace function public.consume_provider_tracking_otp(
  challenge_id uuid,
  recipient_digest text,
  tracking_code_digest text,
  submitted_code_digest text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  challenge public.provider_tracking_email_otps%rowtype;
  recipient public.provider_tracking_recipients%rowtype;
  timestamp_value timestamptz:=clock_timestamp();
begin
  select * into challenge from public.provider_tracking_email_otps
  where id=challenge_id and recipient_email_digest=recipient_digest for update;
  if not found then return null; end if;
  if challenge.used_at is not null or challenge.superseded_at is not null
    or challenge.expires_at<=timestamp_value or challenge.attempt_count>=5
    or challenge.code_digest<>submitted_code_digest then
    if challenge.used_at is null and challenge.superseded_at is null
      and challenge.attempt_count<5 then
      update public.provider_tracking_email_otps
      set attempt_count=least(5,attempt_count+1) where id=challenge.id;
    end if;
    insert into public.audit_logs(id,action,entity_type,entity_id,details,created_at)
    values(gen_random_uuid(),'TRACKING_UNLOCK_DENIED','provider_tracking_email_otp',challenge.id,'{}'::jsonb,timestamp_value);
    return null;
  end if;

  select * into recipient from public.provider_tracking_recipients party
  where party.id=challenge.recipient_id
    and party.shipment_id=challenge.shipment_id
    and party.recipient_email_digest=recipient_digest
    and party.revoked_at is null;
  if not found or not exists(
    select 1
    from public.shipment_party_grants grant_record
    join public.provider_shipments shipment on shipment.id=grant_record.shipment_id
    where grant_record.shipment_id=challenge.shipment_id
      and grant_record.party_role='SHIPPER'
      and grant_record.code_hash=trim(tracking_code_digest)
      and grant_record.revoked_at is null
      and (grant_record.expires_at is null or grant_record.expires_at>timestamp_value)
      and (shipment.guest_expires_at is null or shipment.guest_expires_at>timestamp_value)
  ) then
    update public.provider_tracking_email_otps
    set superseded_at=timestamp_value where id=challenge.id;
    insert into public.audit_logs(id,action,entity_type,entity_id,details,created_at)
    values(gen_random_uuid(),'TRACKING_UNLOCK_DENIED','provider_tracking_email_otp',challenge.id,'{}'::jsonb,timestamp_value);
    return null;
  end if;

  update public.provider_tracking_email_otps set used_at=timestamp_value where id=challenge.id;
  insert into public.audit_logs(id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),'TRACKING_OTP_VERIFIED','provider_tracking_email_otp',challenge.id,
    jsonb_build_object('shipmentId',challenge.shipment_id,'recipientRole',recipient.recipient_role),timestamp_value);
  return jsonb_build_object(
    'id',challenge.shipment_id,
    'recipientDigest',recipient.recipient_email_digest,
    'recipientRole',recipient.recipient_role
  );
end;
$$;

create or replace function public.provider_guest_tracking_for_recipient(
  target_shipment_id uuid,
  requested_recipient_digest text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  recipient_role text;
  result jsonb;
begin
  select party.recipient_role into recipient_role
  from public.provider_tracking_recipients party
  join public.shipment_party_grants grant_record
    on grant_record.shipment_id=party.shipment_id and grant_record.party_role='SHIPPER'
  join public.provider_shipments shipment on shipment.id=party.shipment_id
  where party.shipment_id=target_shipment_id
    and party.recipient_email_digest=requested_recipient_digest
    and party.revoked_at is null
    and grant_record.revoked_at is null
    and (grant_record.expires_at is null or grant_record.expires_at>now())
    and (shipment.guest_expires_at is null or shipment.guest_expires_at>now())
  order by party.created_at desc,party.id
  limit 1;
  if not found then return null; end if;

  result:=public.provider_guest_tracking(target_shipment_id,'SHIPPER');
  if result is null then return null; end if;
  result:=result||jsonb_build_object(
    'recipient_role',recipient_role,
    'party_role',case when recipient_role='OWNER' then 'SHIPPER' else 'RECEIVER' end,
    'can_review',case when recipient_role='OWNER' then coalesce((result->>'can_review')::boolean,false) else false end,
    'review',case when recipient_role='OWNER' then result->'review' else null end
  );
  return result;
end;
$$;

create or replace function public.provider_tracking_guest_cleanup(requested_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  shipment_ids uuid[];
  current_shipment_id uuid;
begin
  select coalesce(array_agg(expired.id),'{}'::uuid[]) into shipment_ids
  from (
    select shipment.id from public.provider_shipments shipment
    where shipment.guest_expires_at is not null and shipment.guest_expires_at<=clock_timestamp()
      and (
        shipment.review_code_hash is not null
        or exists(select 1 from public.shipment_party_grants grant_record where grant_record.shipment_id=shipment.id)
        or exists(select 1 from public.email_deliveries delivery where delivery.shipment_id=shipment.id)
        or exists(select 1 from public.provider_tracking_recipients recipient where recipient.shipment_id=shipment.id)
        or exists(select 1 from public.provider_tracking_email_otps challenge where challenge.shipment_id=shipment.id)
        or shipment.shipper_email not like 'expired+%@redacted.invalid'
        or shipment.receiver_email not like 'expired+%@redacted.invalid'
      )
    order by shipment.guest_expires_at,shipment.id
    limit greatest(1,least(coalesce(requested_limit,100),500))
    for update skip locked
  ) expired;
  if cardinality(shipment_ids)=0 then
    return jsonb_build_object('count',0,'shipmentIds','[]'::jsonb);
  end if;

  delete from public.access_email_deliveries delivery
  using public.provider_tracking_email_otps challenge
  where delivery.delivery_kind='TRACKING_OTP'
    and delivery.entity_id=challenge.id and challenge.shipment_id=any(shipment_ids);
  delete from public.provider_tracking_email_otps where shipment_id=any(shipment_ids);
  delete from public.provider_tracking_recipients where shipment_id=any(shipment_ids);
  delete from public.shipment_party_grants where shipment_id=any(shipment_ids);
  delete from public.email_deliveries where shipment_id=any(shipment_ids);
  update public.provider_shipments set
    shipper_email='expired+'||id::text||'@redacted.invalid',
    receiver_email='expired+'||id::text||'@redacted.invalid',
    review_code_hash=null
  where id=any(shipment_ids);
  foreach current_shipment_id in array shipment_ids loop
    insert into public.audit_logs(id,action,entity_type,entity_id,details,created_at)
    values(gen_random_uuid(),'PROVIDER_TRACKING_GUEST_EXPIRED','provider_shipment',current_shipment_id,'{}'::jsonb,clock_timestamp());
  end loop;
  return jsonb_build_object('count',cardinality(shipment_ids),'shipmentIds',to_jsonb(shipment_ids));
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
        and coalesce(delivery.next_attempt_at,delivery.created_at)<=clock_timestamp()
        and coalesce(delivery.leased_until,'-infinity'::timestamptz)<=clock_timestamp()
        and delivery.attempts<6
        and (
          delivery.delivery_kind='GUEST_SUPPORT'
          or delivery.delivery_kind='SHARED_CAPACITY' and exists(
            select 1 from public.shared_capacity_email_otps challenge
            where challenge.id=delivery.entity_id and challenge.used_at is null
              and challenge.superseded_at is null
              and challenge.expires_at>clock_timestamp()+interval '30 seconds'
              and challenge.attempt_count<5
          )
          or delivery.delivery_kind='TRACKING_OTP' and exists(
            select 1 from public.provider_tracking_email_otps challenge
            join public.provider_tracking_recipients recipient on recipient.id=challenge.recipient_id
            join public.shipment_party_grants grant_record
              on grant_record.shipment_id=challenge.shipment_id and grant_record.party_role='SHIPPER'
            where challenge.id=delivery.entity_id and challenge.used_at is null
              and challenge.superseded_at is null
              and challenge.expires_at>clock_timestamp()+interval '30 seconds'
              and challenge.attempt_count<5 and recipient.revoked_at is null
              and grant_record.revoked_at is null
              and (grant_record.expires_at is null or grant_record.expires_at>clock_timestamp())
          )
        )
      order by case when delivery.delivery_kind in ('SHARED_CAPACITY','TRACKING_OTP') then 0 else 1 end,
        coalesce(delivery.next_attempt_at,delivery.created_at),delivery.created_at,delivery.id
      for update skip locked
      limit greatest(1,least(coalesce(requested_limit,1),1))
    ), claimed as (
      update public.access_email_deliveries delivery
      set lease_token=gen_random_uuid(),leased_until=clock_timestamp()+interval '90 seconds',
        updated_at=clock_timestamp()
      from candidates where delivery.id=candidates.id
      returning delivery.*
    )
    select to_jsonb(claimed)||jsonb_build_object(
      'challenge_expires_at',case
        when claimed.delivery_kind='SHARED_CAPACITY' then (
          select challenge.expires_at from public.shared_capacity_email_otps challenge where challenge.id=claimed.entity_id
        )
        when claimed.delivery_kind='TRACKING_OTP' then (
          select challenge.expires_at from public.provider_tracking_email_otps challenge where challenge.id=claimed.entity_id
        )
        else null end
    )
    from claimed;
end;
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
  if requested_kind not in ('SHARED_CAPACITY','GUEST_SUPPORT','TRACKING_OTP') then
    raise exception 'INVALID_ACCESS_DELIVERY_KIND';
  end if;
  with candidate as (
    select delivery.id
    from public.access_email_deliveries delivery
    where delivery.delivery_kind=requested_kind and delivery.entity_id=requested_entity_id
      and delivery.status in ('QUEUED','FAILED')
      and coalesce(delivery.next_attempt_at,delivery.created_at)<=clock_timestamp()
      and coalesce(delivery.leased_until,'-infinity'::timestamptz)<=clock_timestamp()
      and delivery.attempts<6
      and (
        delivery.delivery_kind='GUEST_SUPPORT'
        or delivery.delivery_kind='SHARED_CAPACITY' and exists(
          select 1 from public.shared_capacity_email_otps challenge
          where challenge.id=delivery.entity_id and challenge.used_at is null
            and challenge.superseded_at is null
            and challenge.expires_at>clock_timestamp()+interval '30 seconds'
            and challenge.attempt_count<5
        )
        or delivery.delivery_kind='TRACKING_OTP' and exists(
          select 1 from public.provider_tracking_email_otps challenge
          join public.provider_tracking_recipients recipient on recipient.id=challenge.recipient_id
          join public.shipment_party_grants grant_record
            on grant_record.shipment_id=challenge.shipment_id and grant_record.party_role='SHIPPER'
          where challenge.id=delivery.entity_id and challenge.used_at is null
            and challenge.superseded_at is null
            and challenge.expires_at>clock_timestamp()+interval '30 seconds'
            and challenge.attempt_count<5 and recipient.revoked_at is null
            and grant_record.revoked_at is null
            and (grant_record.expires_at is null or grant_record.expires_at>clock_timestamp())
        )
      )
    for update skip locked
  ), claimed as (
    update public.access_email_deliveries delivery
    set lease_token=gen_random_uuid(),leased_until=clock_timestamp()+interval '90 seconds',
      updated_at=clock_timestamp()
    from candidate where delivery.id=candidate.id
    returning delivery.*
  )
  select to_jsonb(claimed)||jsonb_build_object(
    'challenge_expires_at',case
      when claimed.delivery_kind='SHARED_CAPACITY' then (
        select challenge.expires_at from public.shared_capacity_email_otps challenge where challenge.id=claimed.entity_id
      )
      when claimed.delivery_kind='TRACKING_OTP' then (
        select challenge.expires_at from public.provider_tracking_email_otps challenge where challenge.id=claimed.entity_id
      )
      else null end
  ) into claimed_payload from claimed;
  return claimed_payload;
end;
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
    select 1 from public.access_email_deliveries delivery
    where delivery.id=delivery_id and delivery.status in ('QUEUED','FAILED')
      and delivery.attempts<6 and delivery.lease_token=claimed_lease_token
      and delivery.leased_until>clock_timestamp()
      and (
        delivery.delivery_kind='GUEST_SUPPORT'
        or delivery.delivery_kind='SHARED_CAPACITY' and exists(
          select 1 from public.shared_capacity_email_otps challenge
          where challenge.id=delivery.entity_id and challenge.used_at is null
            and challenge.superseded_at is null
            and challenge.expires_at>clock_timestamp()+interval '30 seconds'
            and challenge.attempt_count<5
        )
        or delivery.delivery_kind='TRACKING_OTP' and exists(
          select 1 from public.provider_tracking_email_otps challenge
          join public.provider_tracking_recipients recipient on recipient.id=challenge.recipient_id
          join public.shipment_party_grants grant_record
            on grant_record.shipment_id=challenge.shipment_id and grant_record.party_role='SHIPPER'
          where challenge.id=delivery.entity_id and challenge.used_at is null
            and challenge.superseded_at is null
            and challenge.expires_at>clock_timestamp()+interval '30 seconds'
            and challenge.attempt_count<5 and recipient.revoked_at is null
            and grant_record.revoked_at is null
            and (grant_record.expires_at is null or grant_record.expires_at>clock_timestamp())
        )
      )
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
    or delivery.leased_until is null or delivery.leased_until<=clock_timestamp() then return false; end if;

  next_attempt_count:=delivery.attempts+1;
  if not was_sent and delivery.delivery_kind in ('SHARED_CAPACITY','TRACKING_OTP') then
    if delivery.delivery_kind='SHARED_CAPACITY' then
      select challenge.expires_at into challenge_expires_at
      from public.shared_capacity_email_otps challenge where challenge.id=delivery.entity_id;
    else
      select challenge.expires_at into challenge_expires_at
      from public.provider_tracking_email_otps challenge where challenge.id=delivery.entity_id;
    end if;
    retry_at:=clock_timestamp()+make_interval(
      secs=>least(120,(15*power(2,greatest(0,next_attempt_count-1)))::integer)
    );
    if next_attempt_count>=6 or challenge_expires_at is null
      or retry_at>=challenge_expires_at-interval '30 seconds' then
      next_attempt_count:=6;retry_at:=null;
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
    lease_token=null,leased_until=null,updated_at=clock_timestamp()
  where id=delivery.id;
  return true;
end;
$$;

create or replace function public.tracking_email_otp_cleanup(requested_limit integer default 100)
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
  delivery_count integer:=0;
begin
  select coalesce(array_agg(candidate.id),'{}'::uuid[]) into challenge_ids
  from (
    select challenge.id from public.provider_tracking_email_otps challenge
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
    for update skip locked limit bounded_limit
  ) candidate;
  if cardinality(challenge_ids)>0 then
    delete from public.access_email_deliveries delivery
    where delivery.delivery_kind='TRACKING_OTP' and delivery.entity_id=any(challenge_ids);
    get diagnostics delivery_count=row_count;
    delete from public.provider_tracking_email_otps challenge where challenge.id=any(challenge_ids);
    get diagnostics challenge_count=row_count;
  end if;
  return jsonb_build_object('otpCount',challenge_count,'deliveryCount',delivery_count);
end;
$$;

revoke all on function public.create_provider_tracking_with_recipients(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.list_provider_tracking_recipients(uuid,uuid) from public,anon,authenticated;
revoke all on function public.add_provider_tracking_recipient(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.revoke_provider_tracking_recipient(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.request_provider_tracking_otp(uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.consume_provider_tracking_otp(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.provider_guest_tracking_for_recipient(uuid,text) from public,anon,authenticated;
revoke all on function public.tracking_email_otp_cleanup(integer) from public,anon,authenticated;
revoke all on function public.pending_access_email_deliveries(integer) from public,anon,authenticated;
revoke all on function public.claim_access_email_delivery(text,uuid) from public,anon,authenticated;
revoke all on function public.access_email_delivery_is_deliverable(uuid,uuid) from public,anon,authenticated;
revoke all on function public.record_access_email_delivery_attempt(uuid,uuid,boolean,text) from public,anon,authenticated;

grant execute on function public.create_provider_tracking_with_recipients(uuid,jsonb) to service_role;
grant execute on function public.list_provider_tracking_recipients(uuid,uuid) to service_role;
grant execute on function public.add_provider_tracking_recipient(uuid,uuid,text,text) to service_role;
grant execute on function public.revoke_provider_tracking_recipient(uuid,uuid,uuid) to service_role;
grant execute on function public.request_provider_tracking_otp(uuid,text,text,text,text,timestamptz) to service_role;
grant execute on function public.consume_provider_tracking_otp(uuid,text,text,text) to service_role;
grant execute on function public.provider_guest_tracking_for_recipient(uuid,text) to service_role;
grant execute on function public.tracking_email_otp_cleanup(integer) to service_role;
grant execute on function public.pending_access_email_deliveries(integer) to service_role;
grant execute on function public.claim_access_email_delivery(text,uuid) to service_role;
grant execute on function public.access_email_delivery_is_deliverable(uuid,uuid) to service_role;
grant execute on function public.record_access_email_delivery_attempt(uuid,uuid,boolean,text) to service_role;

-- The pre-OTP code-only application entry point remains in migration history
-- for rollback, but cannot be invoked by the active service role after cutover.
revoke execute on function public.unlock_provider_tracking(text) from service_role;
-- The active adapter must use the recipient-fenced projection. Keeping the
-- older projection callable by service code would make that check optional.
revoke execute on function public.provider_guest_tracking(uuid,text) from service_role;

comment on function public.request_provider_tracking_otp(uuid,text,text,text,text,timestamptz) is
  'Creates an email challenge and outbox row only after an exact active recipient-email and Tracking-code match.';
comment on function public.consume_provider_tracking_otp(uuid,text,text,text) is
  'Consumes one single-use Tracking OTP after rechecking shipment code, recipient, revocation, expiry, and attempt limits.';
comment on function public.provider_guest_tracking_for_recipient(uuid,text) is
  'Returns the existing narrow customer-safe Tracking projection only after rechecking an active shipment recipient digest.';
