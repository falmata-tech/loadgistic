-- FEAT-REV-001 / FEAT-PLY-001 / NR-43. Exact synthetic records; all rolled back.
begin;
create function pg_temp.assert_review_restriction(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',message;end if;end $$;
create function pg_temp.review_command_denied(command text,expected text) returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm=expected then return;else raise;end if;end;
 raise exception 'REVIEW_COMMAND_DID_NOT_DENY';
end $$;
create function pg_temp.assert_review_publication(review_id uuid,provider_id uuid,visible boolean,stage text) returns void language plpgsql as $$
declare summary jsonb;
begin
 -- This is the canonical profile's exact public review predicate; the aggregate
 -- is the actual service-only public reputation projection, not a test substitute.
 perform pg_temp.assert_review_restriction(exists(select 1 from public.provider_reviews r where r.id=review_id and r.provider_profile_id=provider_id and r.status='PUBLISHED')=visible,stage||'_PUBLIC_TEXT_WRONG');
 summary:=public.public_provider_review_summary(null,provider_id);
 perform pg_temp.assert_review_restriction((summary->>'review_count')::int=case when visible then 2 else 1 end,stage||'_PUBLIC_COUNT_WRONG');
 perform pg_temp.assert_review_restriction((summary->>'average_rating')::numeric=case when visible then 3.5 else 5 end,stage||'_PUBLIC_AVERAGE_WRONG');
end $$;
do $test$
<<moderation_case>>
declare owner_id uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();trust_id uuid:=gen_random_uuid();outsider_id uuid:=gen_random_uuid();
 provider_id uuid:=gen_random_uuid();truck_id uuid:=gen_random_uuid();shipment_ids uuid[]:=array[gen_random_uuid(),gen_random_uuid()];
 review_id uuid:=gen_random_uuid();control_id uuid:=gen_random_uuid();report_a uuid;report_b uuid;handle text:='moderation-'||provider_id;
 control_before jsonb;review_before jsonb;reports_before jsonb;audits_before bigint;decision text;actor uuid;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select item,'moderation-'||item||'@example.test',now(),'{"full_name":"Synthetic moderation identity"}'::jsonb from unnest(array[owner_id,admin_id,trust_id,outsider_id]) item;
 insert into profiles(id,email,full_name,role,active) values
 (owner_id,'moderation-'||owner_id||'@example.test','Synthetic provider','DRIVER',true),
 (admin_id,'moderation-'||admin_id||'@example.test','Synthetic administrator','ADMIN',true),
 (trust_id,'moderation-'||trust_id||'@example.test','Synthetic Trust reviewer','SUPPORT',true),
 (outsider_id,'moderation-'||outsider_id||'@example.test','Unrelated reviewer','SUPPORT',true)
 on conflict(id) do update set role=excluded.role,active=true;
 insert into support_agent_profiles(user_id,active,available,can_manage_support,can_manage_trust) values(trust_id,true,false,false,true),(outsider_id,true,false,true,false);
 insert into provider_profiles(id,user_id,business_name,handle,public_visibility) values(provider_id,owner_id,'Synthetic moderation transporter',handle,'PUBLIC');
 insert into company_pages(provider_profile_id,published,about) values(provider_id,true,'Synthetic public moderation profile.');
 insert into vehicles(id,provider_profile_id,label,make,model,category,cargo_configuration,active,use_basis) values(truck_id,provider_id,'Synthetic review truck','Synthetic','Review truck','LIGHT','Pickup truck',true,'OWNED');
 insert into provider_shipments(id,code,provider_profile_id,assigned_vehicle_id,assigned_driver_user_id,
 origin,origin_place_ref,origin_lat,origin_lng,destination,destination_place_ref,destination_lat,destination_lng,
 cargo_summary,shipper_email,receiver_email,operational_status,created_by,completed_at)
 select item,'MR-'||substr(md5(item::text),1,12),provider_id,truck_id,owner_id,
 o.name,o.id,o.latitude,o.longitude,d.name,d.id,d.latitude,d.longitude,
 'Synthetic completed review shipment','moderation-owner@example.test','moderation-owner@example.test','COMPLETED',owner_id,now()
 from unnest(shipment_ids) item cross join lateral(select * from place_catalog order by id limit 1)o
 cross join lateral(select * from place_catalog where id<>o.id order by id limit 1)d;
 insert into provider_reviews(id,shipment_id,provider_profile_id,rating,note) values
 (review_id,shipment_ids[1],provider_id,2,'Exact reported review text'),(control_id,shipment_ids[2],provider_id,5,'Unrelated public review');
 select to_jsonb(r) into control_before from provider_reviews r where r.id=control_id;
 perform pg_temp.assert_review_publication(review_id,provider_id,true,'INITIAL');

 -- Both reports are accepted while the review is public. One restore must not
 -- override the second hidden report, even though their state machines differ.
 report_a:=submit_content_report(handle,repeat('a',64),'REVIEW','First synthetic review report.',review_id);
 report_b:=submit_content_report(handle,repeat('b',64),'REVIEW','Second synthetic review report.',review_id);
 perform moderate_content_report(admin_id,report_a,'HIDE','First review report investigated.');
 perform moderate_content_report(trust_id,report_b,'HIDE','Second review report investigated.');
 perform pg_temp.assert_review_publication(review_id,provider_id,false,'BOTH_HIDDEN');
 perform moderate_content_report(trust_id,report_a,'RESTORE','First report independently resolved.');
 perform pg_temp.assert_review_publication(review_id,provider_id,false,'OTHER_REPORT_STILL_HIDDEN');
 perform pg_temp.assert_review_restriction((select status='HIDDEN' from content_reports where id=report_b),'OTHER_REPORT_STATE_OVERWRITTEN');
 perform moderate_content_report(admin_id,report_b,'RESTORE','Final content restriction resolved.');
 perform pg_temp.assert_review_publication(review_id,provider_id,true,'ALL_REPORTS_RESTORED');

 -- A content hold survives upholding a pending rating; restoring the hold may
 -- then publish without changing the independent UPHELD decision or its note.
 update provider_reviews set dispute_status='PENDING',dispute_reason='Synthetic pending dispute' where id=review_id;
 report_a:=submit_content_report(handle,repeat('c',64),'REVIEW','Content and pending dispute.',review_id);
 perform moderate_content_report(trust_id,report_a,'HIDE','Content requires a restriction.');
 perform resolve_provider_review_dispute(trust_id,review_id,'UPHELD','Rating evidence remains valid.');
 perform pg_temp.assert_review_publication(review_id,provider_id,false,'UPHELD_WITH_HIDDEN_REPORT');
 perform pg_temp.assert_review_restriction((select status='HIDDEN' from content_reports where id=report_a),'UPHELD_CHANGED_REPORT');
 perform moderate_content_report(admin_id,report_a,'RESTORE','The independent content issue is resolved.');
 perform pg_temp.assert_review_publication(review_id,provider_id,true,'UPHELD_AND_RESTORED');
 perform pg_temp.assert_review_restriction((select dispute_status='UPHELD' and review_note='Rating evidence remains valid.' from provider_reviews where id=review_id),'CONTENT_RESTORE_CHANGED_RATING_DECISION');

 -- Terminal rating removal survives either ordering of HIDE and REMOVED.
 foreach decision in array array['HIDE_FIRST','RATING_FIRST'] loop
  update provider_reviews set status='PUBLISHED',dispute_status='PENDING',dispute_reason='Synthetic pending dispute' where id=review_id;
  report_a:=submit_content_report(handle,repeat(case when decision='HIDE_FIRST' then 'd' else 'e' end,64),'REVIEW','Independent terminal rating and content report.',review_id);
  if decision='HIDE_FIRST' then perform moderate_content_report(admin_id,report_a,'HIDE','Content restriction remains independently recorded.');end if;
  perform resolve_provider_review_dispute(trust_id,review_id,'REMOVED','Rating removed after investigation.');
  if decision='RATING_FIRST' then perform moderate_content_report(admin_id,report_a,'HIDE','Content restriction remains independently recorded.');end if;
  perform moderate_content_report(admin_id,report_a,'RESTORE','This content report is independently resolved.');
  perform pg_temp.assert_review_publication(review_id,provider_id,false,decision||'_TERMINAL_RATING_REMOVED');
  perform pg_temp.assert_review_restriction((select dispute_status='REMOVED' and review_note='Rating removed after investigation.' from provider_reviews where id=review_id),'CONTENT_RESTORE_OVERRULED_TERMINAL_RATING');
 end loop;

 -- The opposite order still allows a newly imposed content hold and a later
 -- authorized restore, without treating a pending dispute as a removal.
 update provider_reviews set status='PUBLISHED',dispute_status='PENDING' where id=review_id;
 report_a:=submit_content_report(handle,repeat('f',64),'REVIEW','Uphold before content investigation.',review_id);
 perform resolve_provider_review_dispute(admin_id,review_id,'UPHELD','Rating checked before content review.');
 perform moderate_content_report(trust_id,report_a,'HIDE','New independent content restriction.');
 perform pg_temp.assert_review_publication(review_id,provider_id,false,'HIDE_AFTER_UPHOLD');
 perform moderate_content_report(trust_id,report_a,'RESTORE','Independent content restriction resolved.');
 perform pg_temp.assert_review_publication(review_id,provider_id,true,'RESTORE_AFTER_UPHOLD');

 -- Terminal replay, wrong authority and current Trust revocation must leave
 -- review/report/audit state byte-for-byte unchanged.
 select to_jsonb(r) into review_before from provider_reviews r where r.id=review_id;
 select jsonb_agg(to_jsonb(r) order by r.id) into reports_before from content_reports r where r.review_id=moderation_case.review_id;
 select count(*) into audits_before from audit_logs;
 perform pg_temp.review_command_denied(format('select resolve_provider_review_dispute(%L,%L,''REMOVED'',''Do not replay terminal decisions.'')',admin_id,review_id),'RATING_ALREADY_REVIEWED');
 perform pg_temp.review_command_denied(format('select moderate_content_report(%L,%L,''RESTORE'',''Do not replay terminal reports.'')',admin_id,report_a),'REPORT_ALREADY_REVIEWED');
 foreach actor in array array[owner_id,outsider_id,null::uuid] loop
  perform pg_temp.review_command_denied(format('select resolve_provider_review_dispute(%L,%L,''UPHELD'',''Caller cannot review ratings.'')',actor,review_id),'FORBIDDEN');
  perform pg_temp.review_command_denied(format('select moderate_content_report(%L,%L,''HIDE'',''Caller cannot moderate content.'')',actor,report_a),'FORBIDDEN');
 end loop;
 update support_agent_profiles set can_manage_trust=false where user_id=trust_id;
 perform pg_temp.review_command_denied(format('select resolve_provider_review_dispute(%L,%L,''UPHELD'',''Revoked Trust must be denied.'')',trust_id,review_id),'FORBIDDEN');
 perform pg_temp.review_command_denied(format('select moderate_content_report(%L,%L,''HIDE'',''Revoked Trust must be denied.'')',trust_id,report_a),'FORBIDDEN');
 perform pg_temp.assert_review_restriction((select to_jsonb(r)=review_before from provider_reviews r where r.id=review_id),'DENIED_REVIEW_CHANGED');
 perform pg_temp.assert_review_restriction((select jsonb_agg(to_jsonb(r) order by r.id)=reports_before from content_reports r where r.review_id=moderation_case.review_id),'DENIED_REPORT_CHANGED');
 perform pg_temp.assert_review_restriction((select count(*) from audit_logs)=audits_before,'DENIED_REVIEW_AUDIT_CHANGED');
 perform pg_temp.assert_review_restriction((select to_jsonb(r)=control_before from provider_reviews r where r.id=control_id),'UNRELATED_REVIEW_CHANGED');
 perform pg_temp.assert_review_restriction((select count(*) from audit_logs where entity_id=report_b and action='CONTENT_REPORT_HIDE' and actor_user_id=trust_id)=1,'CONTENT_HIDE_AUDIT_WRONG');
 perform pg_temp.assert_review_restriction((select count(*) from audit_logs where entity_id=report_b and action='CONTENT_REPORT_RESTORE' and actor_user_id=admin_id)=1,'CONTENT_RESTORE_AUDIT_WRONG');
 perform pg_temp.assert_review_restriction(not has_function_privilege('anon','public.moderate_content_report(uuid,uuid,text,text)','EXECUTE') and not has_function_privilege('authenticated','public.resolve_provider_review_dispute(uuid,uuid,text,text)','EXECUTE'),'BROWSER_REVIEW_COMMAND_EXPOSED');
 raise notice 'PASS: independent review restrictions, both command orders, public text/count/average, audit and denial';
end $test$;
rollback;
