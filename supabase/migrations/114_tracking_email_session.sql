-- ADR-073 / FEAT-TRK-001 / FEAT-REV-001. Additive service-only email access.
create or replace function public.request_tracking_email_session(
 challenge_id uuid, normalized_recipient_email text, recipient_digest text,
 challenge_code_digest text, challenge_expires_at timestamptz
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare chosen_code text; stamp timestamptz:=clock_timestamp();
begin
 if normalized_recipient_email is null or recipient_digest is null
   or recipient_digest!~'^[a-f0-9]{64}$' or challenge_code_digest is null
   or challenge_expires_at is null then raise exception 'INVALID_TRACKING_OTP_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended('tracking-email:'||recipient_digest,0));
 select g.code_hash into chosen_code
 from provider_tracking_recipients r
 join provider_shipments s on s.id=r.shipment_id
 join shipment_party_grants g on g.shipment_id=s.id and g.party_role='SHIPPER'
 where r.recipient_email_digest=recipient_digest
   and r.recipient_email=lower(trim(normalized_recipient_email)) and r.revoked_at is null
   and g.revoked_at is null and (g.expires_at is null or g.expires_at>stamp)
   and (s.guest_expires_at is null or s.guest_expires_at>stamp)
 order by r.created_at desc,r.id limit 1;
 if not found then return false; end if;
 update provider_tracking_email_otps set superseded_at=stamp
 where recipient_email_digest=recipient_digest and used_at is null and superseded_at is null;
 return request_provider_tracking_otp(challenge_id,normalized_recipient_email,recipient_digest,
   chosen_code,challenge_code_digest,challenge_expires_at);
end; $$;

create or replace function public.consume_tracking_email_session(
 challenge_id uuid, recipient_digest text, submitted_code_digest text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare chosen_code text;
begin
 if recipient_digest is null or submitted_code_digest is null then return null; end if;
 select g.code_hash into chosen_code from provider_tracking_email_otps c
 join shipment_party_grants g on g.shipment_id=c.shipment_id and g.party_role='SHIPPER'
 where c.id=challenge_id and c.recipient_email_digest=recipient_digest;
 if not found then return null; end if;
 -- Existing command owns attempts, expiry, single-use and current grant checks.
 return consume_provider_tracking_otp(challenge_id,recipient_digest,chosen_code,submitted_code_digest);
end; $$;

create or replace function public.list_tracking_email_shipments(
 requested_recipient_digest text, requested_offset integer default 0
) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with eligible as (
 select s.id,s.code,s.origin,s.destination,s.operational_status,s.created_at
 from provider_shipments s
 where exists(select 1 from provider_tracking_recipients r
   join shipment_party_grants g on g.shipment_id=r.shipment_id and g.party_role='SHIPPER'
   where r.shipment_id=s.id and r.recipient_email_digest=requested_recipient_digest
     and r.revoked_at is null and g.revoked_at is null
     and (g.expires_at is null or g.expires_at>now()))
   and (s.guest_expires_at is null or s.guest_expires_at>now())
 ), page as (select * from eligible order by created_at desc,id
 limit 20 offset greatest(0,least(coalesce(requested_offset,0),100000)))
 select jsonb_build_object('total',(select count(*) from eligible),
 'items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id) from page),'[]'::jsonb));
$$;

create or replace function public.submit_tracking_email_review(
 target_shipment_id uuid, requested_recipient_digest text, requested_rating integer, requested_note text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- Serialize against recipient revocation; role comes from persistence, never the client.
 perform 1 from provider_tracking_recipients r where r.shipment_id=target_shipment_id
 and r.recipient_email_digest=requested_recipient_digest and r.recipient_role='OWNER'
 and r.revoked_at is null for update;
 if not found or requested_rating is null then raise exception 'REVIEW_NOT_ALLOWED'; end if;
 return submit_provider_tracking_review(target_shipment_id,'SHIPPER',requested_rating,requested_note);
end; $$;

revoke all on function public.request_tracking_email_session(uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.consume_tracking_email_session(uuid,text,text) from public,anon,authenticated;
revoke all on function public.list_tracking_email_shipments(text,integer) from public,anon,authenticated;
revoke all on function public.submit_tracking_email_review(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.request_tracking_email_session(uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.consume_tracking_email_session(uuid,text,text) to service_role;
grant execute on function public.list_tracking_email_shipments(text,integer) to service_role;
grant execute on function public.submit_tracking_email_review(uuid,text,integer,text) to service_role;
