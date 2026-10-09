-- Only synthetic local data, all rolled back. Run after migration 131.
begin;
do $test$
declare subject uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); provider uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid();org uuid:=gen_random_uuid();
 r jsonb; request_id uuid; result jsonb; retained_name text; denied boolean; path text:='supabase://provider-profile/driver-portrait/2026-10-09/00000000-0000-4000-8000-000000000001.jpg';
begin
 insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_user_meta_data)
 values(subject,'erase-synthetic@example.test',now(),now(),'{"full_name":"Synthetic erase subject"}'),(other,'erase-unrelated@example.test',now(),now(),'{"full_name":"Unrelated subject"}'),(admin_id,'erase-admin@example.test',now(),now(),'{"full_name":"Synthetic administrator"}');
 insert into profiles(id,email,full_name,role,active) values(admin_id,'erase-admin@example.test','Synthetic administrator','ADMIN',true) on conflict(id) do update set role='ADMIN',active=true;
 insert into profiles(id,email,full_name,role,active) values(subject,'erase-synthetic@example.test','Synthetic erase subject','DRIVER',true),(other,'erase-unrelated@example.test','Unrelated subject','DRIVER',true)
 on conflict(id) do update set role='DRIVER',active=true;
 insert into provider_profiles(id,user_id,business_name,handle,phone,about) values(provider,subject,'Synthetic erase business','erase-'||subject,'123456789','Private bio to erase');
 insert into company_pages(provider_profile_id,headline,about,published) values(provider,'Synthetic headline','Private description',true);
 insert into driver_portrait_uploads(user_id,file_path,size_bytes,state,upload_finished) values(subject,path,100,'ACTIVE',true);
 r:=request_account_deletion(subject);request_id:=(r->>'id')::uuid;
 if r->>'status'<>'REQUESTED' or (request_account_deletion(subject)->>'id')::uuid<>request_id then raise exception 'DELETION_NOT_IDEMPOTENT';end if;
 if account_deletion_status(other)<>'null'::jsonb then raise exception 'CROSS_ACCOUNT_STATUS';end if;
 denied:=false;begin perform prepare_account_erasure(other,request_id);exception when others then if sqlerrm='FORBIDDEN' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'NONADMIN_ERASURE';end if;
 result:=prepare_account_erasure(admin_id,request_id);
 if result->>'status'<>'ERASING' or (select active from profiles where id=subject) then raise exception 'ERASURE_NOT_STARTED';end if;
 if (select public_visibility from provider_profiles where id=provider)<>'PRIVATE' then raise exception 'ERASING_STILL_PUBLIC';end if;
 if not exists(select 1 from account_erasure_files f where f.request_id=(r->>'id')::uuid and f.storage_path=path) then raise exception 'FILE_CLEANUP_NOT_RESERVED';end if;
 denied:=false;begin perform finish_account_erasure(admin_id,request_id);exception when others then if sqlerrm='ERASURE_CLEANUP_INCOMPLETE' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'FALSE_COMPLETION';end if;
 update account_erasure_files f set removed_at=now() where f.request_id=(r->>'id')::uuid;
 update auth.users set deleted_at=now() where id=subject;
 result:=finish_account_erasure(admin_id,request_id);
 if result->>'status'<>'COMPLETED' or (select full_name from profiles where id=subject)<>'Deleted account' then raise exception 'PERSONAL_DATA_NOT_ERASED';end if;
 if (select phone is not null or about is not null from provider_profiles where id=provider) then raise exception 'PUBLIC_PERSONAL_DATA_RETAINED';end if;
 if exists(select 1 from driver_portrait_uploads where user_id=subject) then raise exception 'PORTRAIT_RETAINED';end if;
 if (select full_name from profiles where id=other)<>'Unrelated subject' or not(select active from profiles where id=other) then raise exception 'UNRELATED_ACCOUNT_CHANGED';end if;
 if finish_account_erasure(admin_id,request_id)->>'status'<>'COMPLETED' then raise exception 'COMPLETION_NOT_IDEMPOTENT';end if;
 insert into organizations(id,name,handle,type) values(org,'Synthetic shared company','erase-shared-'||org,'TRANSPORT_COMPANY');
 insert into organization_members(user_id,organization_id,membership_role) values(other,org,'OWNER'),(admin_id,org,'MEMBER');
 r:=request_account_deletion(other);
 if r->>'status'<>'REQUESTED' then raise exception 'ACTIVE_WORK_PREVENTED_REQUEST';end if;
 result:=prepare_account_erasure(admin_id,(r->>'id')::uuid);
 if result->>'status'<>'HELD' or not(select active from profiles where id=other) then raise exception 'SHARED_FLEET_ERASED';end if;
 if account_deletion_status(other)->>'retentionReason' is null then raise exception 'HOLD_NOT_EXPLAINED';end if;
 if has_table_privilege('anon','public.account_deletion_requests','SELECT') or has_table_privilege('authenticated','public.account_erasure_files','SELECT')
 or has_function_privilege('authenticated','public.prepare_account_erasure(uuid,uuid)','EXECUTE') then raise exception 'BROWSER_PRIVACY_ACCESS';end if;
 raise notice 'Deletion request/idempotency, administrator denial, real scrub, cleanup ordering and unrelated preservation pass';
end $test$;
rollback;
