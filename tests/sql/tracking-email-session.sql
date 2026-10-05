begin;
do $test$
declare ids uuid[]; s uuid; actor uuid; challenge uuid; newer uuid; digest text:=repeat('c',64);
 result jsonb; role_name text; signature text; i integer;
begin
 -- Own rollback-only shipment fixtures: a production restore may have no shipments.
 ids:=array[gen_random_uuid(),gen_random_uuid()];
 select p.user_id into strict actor from provider_profiles p
 join profiles u on u.id=p.user_id and u.active
 join vehicles v on v.provider_profile_id=p.id and v.active limit 1;
 insert into provider_shipments(id,code,provider_profile_id,assigned_vehicle_id,
 assigned_driver_user_id,origin,origin_place_ref,origin_lat,origin_lng,
 destination,destination_place_ref,destination_lat,destination_lng,cargo_summary,
 shipper_email,receiver_email,operational_status,created_by,review_code_hash)
 select fixture_id,'LGX-'||upper(substr(md5(fixture_id::text),1,8)),v.provider_profile_id,v.id,
 actor,o.name,o.id,o.latitude,o.longitude,d.name,d.id,d.latitude,d.longitude,
 'Isolated email-session regression','email-session@example.test','email-session@example.test',
 'CREATED',actor,md5(fixture_id::text)||md5(fixture_id::text)
 from unnest(ids) fixture_id
 cross join lateral (select vehicle.* from vehicles vehicle join provider_profiles provider
 on provider.id=vehicle.provider_profile_id where provider.user_id=actor and vehicle.active limit 1) v
 cross join lateral (select * from place_catalog order by id limit 1) o
 cross join lateral (select * from place_catalog where id<>o.id order by id limit 1) d;
 if (select count(*) from provider_shipments where id=any(ids))<>2 then raise exception 'TWO_SYNTHETIC_SHIPMENTS_REQUIRED'; end if;
 delete from provider_tracking_recipients where shipment_id=any(ids);
 delete from provider_reviews where shipment_id=any(ids);
 update provider_shipments set guest_expires_at=now()+interval '1 day',operational_status='CREATED' where id=any(ids);
 foreach s in array ids loop
 insert into shipment_party_grants(shipment_id,party_role,code_hash,expires_at)
 values(s,'SHIPPER',md5(s::text)||md5(s::text),now()+interval '1 day') on conflict(shipment_id,party_role)
 do update set revoked_at=null,expires_at=excluded.expires_at,code_hash=excluded.code_hash;
 insert into provider_tracking_recipients(shipment_id,recipient_role,recipient_email,recipient_email_digest,created_by)
 values(s,case when s=ids[1] then 'OWNER' else 'TRACKING_PARTY' end,'email-session@example.test',digest,actor);
 end loop;
 result:=list_tracking_email_shipments(digest);
 if (result->>'total')::int<>2 or jsonb_array_length(result->'items')<>2 then raise exception 'SHARED_SHIPMENTS_MISSING'; end if;
 if result::text~'recipient_email|code_hash|proof_storage|customer_email' then raise exception 'PRIVATE_PROJECTION_LEAK'; end if;
 if (list_tracking_email_shipments(repeat('f',64))->>'total')::int<>0 then raise exception 'UNRELATED_LIST'; end if;
 if jsonb_array_length(list_tracking_email_shipments(digest,1)->'items')<>1 then raise exception 'PAGINATION'; end if;
 challenge:=gen_random_uuid();
 if request_tracking_email_session(challenge,'unknown@example.test',repeat('e',64),'otp',now()+interval '10 minutes') then raise exception 'UNKNOWN_ELIGIBLE'; end if;
 if exists(select 1 from provider_tracking_email_otps where id=challenge) or exists(select 1 from access_email_deliveries where entity_id=challenge) then raise exception 'UNKNOWN_EMAIL_SENT'; end if;
 if request_tracking_email_session(challenge,'wrong@example.test',digest,'otp',now()+interval '10 minutes') then raise exception 'EMAIL_DIGEST_MISMATCH'; end if;
 if not request_tracking_email_session(challenge,'email-session@example.test',digest,'otp',now()+interval '10 minutes') then raise exception 'NO_EMAIL_OTP'; end if;
 if consume_tracking_email_session(challenge,digest,'wrong') is not null then raise exception 'WRONG_OTP'; end if;
 if consume_tracking_email_session(challenge,repeat('e',64),'otp') is not null then raise exception 'WRONG_EMAIL'; end if;
 result:=consume_tracking_email_session(challenge,digest,'otp');
 if result->>'recipientDigest'<>digest then raise exception 'OTP_FAILED'; end if;
 if consume_tracking_email_session(challenge,digest,'otp') is not null then raise exception 'REPLAY'; end if;
 challenge:=gen_random_uuid();newer:=gen_random_uuid();
 perform request_tracking_email_session(challenge,'email-session@example.test',digest,'otp',now()+interval '10 minutes');
 perform request_tracking_email_session(newer,'email-session@example.test',digest,'next',now()+interval '10 minutes');
 if consume_tracking_email_session(challenge,digest,'otp') is not null then raise exception 'SUPERSEDED'; end if;
 for i in 1..5 loop perform consume_tracking_email_session(newer,digest,'wrong'); end loop;
 if consume_tracking_email_session(newer,digest,'next') is not null then raise exception 'ATTEMPTS_BYPASSED'; end if;
 challenge:=gen_random_uuid();perform request_tracking_email_session(challenge,'email-session@example.test',digest,'otp',now()+interval '10 minutes');
 update provider_tracking_email_otps set expires_at=now()-interval '1 second' where id=challenge;
 if consume_tracking_email_session(challenge,digest,'otp') is not null then raise exception 'EXPIRED_OTP'; end if;
 begin perform submit_tracking_email_review(ids[1],digest,4,'Premature');raise exception 'INCOMPLETE_REVIEW_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_NOT_ALLOWED' then raise;end if;end;
 update provider_shipments set operational_status='COMPLETED' where id=any(ids);
 begin perform submit_tracking_email_review(ids[2],digest,4,'Not owner');raise exception 'NONOWNER_REVIEW_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_NOT_ALLOWED' then raise;end if;end;
 perform submit_tracking_email_review(ids[1],digest,4,'Owner email verified');
 begin perform submit_tracking_email_review(ids[1],digest,4,'Duplicate');raise exception 'DUPLICATE_REVIEW';exception when raise_exception then if sqlerrm<>'REVIEW_ALREADY_SUBMITTED' then raise;end if;end;
 challenge:=gen_random_uuid();perform request_tracking_email_session(challenge,'email-session@example.test',digest,'otp',now()+interval '10 minutes');
 update provider_tracking_recipients set revoked_at=now() where shipment_id=any(ids);
 if consume_tracking_email_session(challenge,digest,'otp') is not null then raise exception 'REVOKED_OTP'; end if;
 if (list_tracking_email_shipments(digest)->>'total')::int<>0 or provider_guest_tracking_for_recipient(ids[1],digest) is not null then raise exception 'REVOKED_READ'; end if;
 begin perform submit_tracking_email_review(ids[1],digest,4,'Revoked');raise exception 'REVOKED_REVIEW';exception when raise_exception then if sqlerrm<>'REVIEW_NOT_ALLOWED' then raise;end if;end;
 update provider_tracking_recipients set revoked_at=null where shipment_id=any(ids);
 update provider_shipments set guest_expires_at=now()-interval '1 second' where id=any(ids);
 if (list_tracking_email_shipments(digest)->>'total')::int<>0 then raise exception 'EXPIRED_LIST'; end if;
 foreach role_name in array array['anon','authenticated'] loop
 foreach signature in array array['request_tracking_email_session(uuid,text,text,text,timestamptz)','consume_tracking_email_session(uuid,text,text)','list_tracking_email_shipments(text,integer)','submit_tracking_email_review(uuid,text,integer,text)'] loop
 if has_function_privilege(role_name,'public.'||signature,'execute') then raise exception 'BROWSER_RPC_ACCESS';end if;
 end loop;end loop;
end;$test$;
rollback;
