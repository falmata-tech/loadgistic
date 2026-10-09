begin;
do $test$
declare actor uuid:=gen_random_uuid();other uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();foreign_provider uuid:=gen_random_uuid();truck uuid:=gen_random_uuid();r jsonb;denied boolean;digest text:=encode(gen_random_bytes(32),'hex');
begin
 insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_user_meta_data) values
 (actor,'scope-review@example.test',now(),now(),'{"full_name":"Synthetic review"}'),(other,'scope-other@example.test',now(),now(),'{"full_name":"Synthetic other"}'),(admin_id,'scope-admin@example.test',now(),now(),'{"full_name":"Synthetic admin"}');
 update profiles set role='DRIVER',active=true where id in(actor,other);
 update profiles set role='ADMIN',active=true where id=admin_id;
 insert into provider_profiles(id,user_id,business_name,handle,review_workspace) values(provider,actor,'Synthetic review','review-scope-'||actor,true),(foreign_provider,other,'Synthetic other','other-scope-'||other,false);
 insert into app_review_accounts(user_id,provider_profile_id,expected_role,capacity_digest,tracking_digest) values(actor,provider,'DRIVER',digest,encode(gen_random_bytes(32),'hex'));
 if native_review_visitor_digest(actor,'capacity')<>digest or native_review_visitor_digest(other,'capacity') is not null then raise exception 'REVIEW_SCOPE_AUTHORITY';end if;
 insert into vehicles(id,provider_profile_id,label,category,cargo_configuration,active) values(truck,foreign_provider,'Synthetic foreign truck','BOX','Mini Box Truck',true);
 insert into capacity_access_grants(vehicle_id,audience_type,recipient_email,recipient_email_digest,created_by) values(truck,'EMAIL','synthetic@review.invalid',digest,other);
 if native_review_visitor_digest(actor,'capacity') is not null then raise exception 'REVIEW_FOREIGN_CAPACITY_EXPOSED';end if;
 delete from capacity_access_grants where vehicle_id=truck;
 update app_review_accounts set enabled=false where user_id=actor;
 if native_review_visitor_digest(actor,'tracking') is not null then raise exception 'REVOKED_VISITOR_ALLOWED';end if;
 r:=request_account_deletion(actor);perform prepare_account_erasure(admin_id,(r->>'id')::uuid);
 denied:=false;begin update profiles set active=true where id=actor;exception when others then if sqlerrm='ACCOUNT_ERASURE_IN_PROGRESS' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'ERASING_ACCOUNT_REACTIVATED';end if;
 denied:=false;begin update provider_profiles set user_id=other where id=provider;exception when others then if sqlerrm='ACCOUNT_ERASURE_IN_PROGRESS' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'ERASING_SCOPE_TRANSFERRED';end if;
 denied:=false;begin insert into vehicles(provider_profile_id,label,category,cargo_configuration) values(provider,'Late truck','BOX','Mini Box Truck');exception when others then if sqlerrm='ACCOUNT_ERASURE_IN_PROGRESS' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'ERASING_SCOPE_EXPANDED';end if;
 if has_function_privilege('anon','public.native_review_visitor_digest(uuid,text)','EXECUTE') then raise exception 'BROWSER_REVIEW_AUTHORITY';end if;
 raise notice 'Foreign guest grants, revocation, erasure reactivation/transfer/expansion safeguards pass';
end $test$;
rollback;
