-- ADR-079 / FEAT-VER/PLY-001. Synthetic and rollback-only, no Storage deletion.
begin;
do $test$
declare subject uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();admin_id uuid;truck uuid;source_id uuid;review_id uuid;
 deletion_id uuid;result jsonb;audit_before jsonb;
begin
 select id into strict admin_id from public.profiles where active and role='ADMIN' order by id limit 1;
 insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_app_meta_data,raw_user_meta_data)
 values(subject,'authority-erasure-'||subject||'@example.test',now(),now(),'{}','{"full_name":"Synthetic privacy subject"}');
 update public.profiles set role='DRIVER',active=true,first_name='Synthetic',last_name='Private Father' where id=subject;
 insert into public.provider_profiles(id,user_id,business_name,handle) values(provider,subject,'Synthetic private provider','authority-erase-'||subject);
 truck:=(public.create_provider_vehicle(subject,'{"make":"Isuzu","model":"Privacy fixture","plate":"AUTHORITY-ERASE","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 source_id:=public.submit_managed_verification(subject,jsonb_build_object('subject_type','VEHICLE','subject_id',truck,
  'verification_type','VEHICLE_OWNERSHIP','document_name','Private holder title','storage_path','supabase://verification/verification/authority-erasure.pdf',
  'original_name','private-title.pdf','mime_type','application/pdf'));
 perform public.review_managed_verification(admin_id,source_id,'APPROVED','Private original reviewed.');
 review_id:=public.confirm_provider_vehicle_authority(admin_id,source_id,jsonb_build_object('fact_kind','OWNERSHIP','review_note','Synthetic private holder matches the title.',
  'context_revision',public.managed_provider_authority_review_context(admin_id,array[source_id])->0->>'contextRevision'));
 select jsonb_agg(to_jsonb(a) order by a.id) into audit_before from public.audit_logs a where a.entity_type='provider_vehicle_authority_review' and a.entity_id=review_id;
 if audit_before is null or audit_before::text like '%Synthetic private holder%' then raise exception 'AUTHORITY_AUDIT_PRIVATE_NOTE_LEAK';end if;
 deletion_id:=(public.request_account_deletion(subject)->>'id')::uuid;
 result:=public.prepare_account_erasure(admin_id,deletion_id);
 if result->>'status'<>'ERASING' then raise exception 'AUTHORITY_ERASURE_PREPARE_FAILED';end if;
 if not exists(select 1 from public.provider_vehicle_authority_reviews where id=review_id) then raise exception 'PREPARE_DELETED_AUTHORITY_HISTORY';end if;
 if public.provider_scope_can_publish(null,provider) then raise exception 'ERASING_PROVIDER_REMAINS_QUALIFIED';end if;
 -- Same isolated SQL boundary used by account-deletion.sql: external Storage and
 -- Auth deletion are acknowledged as completed metadata, not claimed as tested.
 update public.account_erasure_files set removed_at=now() where account_erasure_files.request_id=deletion_id;
 update auth.users set deleted_at=now() where id=subject;
 result:=public.finish_account_erasure(admin_id,deletion_id);
 if result->>'status'<>'COMPLETED' then raise exception 'AUTHORITY_FK_BLOCKED_ACCOUNT_ERASURE';end if;
 if exists(select 1 from public.verification_requests where id=source_id)
  or exists(select 1 from public.provider_vehicle_authority_reviews where id=review_id) then raise exception 'AUTHORITY_PRIVATE_ERASURE_INCOMPLETE';end if;
 if(select jsonb_agg(to_jsonb(a) order by a.id) from public.audit_logs a where a.entity_type='provider_vehicle_authority_review' and a.entity_id=review_id) is distinct from audit_before then raise exception 'AUTHORITY_PSEUDONYMOUS_AUDIT_LOST';end if;
 if not exists(select 1 from public.vehicles where id=truck and not active and plate is null) then raise exception 'ARCHIVED_TRUCK_HISTORY_LOST';end if;
 if public.finish_account_erasure(admin_id,deletion_id)->>'status'<>'COMPLETED' then raise exception 'AUTHORITY_ERASURE_REPLAY_NOT_IDEMPOTENT';end if;
 raise notice 'PASS: authority source deletion compatibility, private notes erased only on authorized completion, archived truck IDs and pseudonymous audit retained';
end $test$;
rollback;
