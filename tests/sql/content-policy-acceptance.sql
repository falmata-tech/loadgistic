begin;
do $test$
declare actor uuid:=gen_random_uuid();result uuid;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(actor,'policy-synthetic@example.test',now(),'{"full_name":"Synthetic policy actor"}');
 insert into profiles(id,email,full_name,role,active) values(actor,'policy-synthetic@example.test','Synthetic policy actor','DRIVER',true) on conflict(id) do update set role='DRIVER',active=true;
 if content_policy_accepted(actor) then raise exception 'CONSENT_INVENTED';end if;
 denied:=false;begin perform reserve_driver_portrait(actor,'supabase://provider-profile/driver-portrait/2026-10-09/00000000-0000-4000-8000-000000000001.jpg',100);exception when others then if sqlerrm='POLICY_REQUIRED' then denied:=true;else raise;end if;end;
 if not denied or exists(select 1 from driver_portrait_uploads where user_id=actor) then raise exception 'CONTENT_WRITTEN_WITHOUT_ACCEPTANCE';end if;
 denied:=false;begin perform accept_content_policy(actor,'outdated');exception when others then if sqlerrm='POLICY_VERSION_CHANGED' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'OLD_POLICY_ACCEPTED';end if;
 perform accept_content_policy(actor,'2026-10-09');
 if not content_policy_accepted(actor) then raise exception 'CONSENT_NOT_SAVED';end if;
 result:=reserve_driver_portrait(actor,'supabase://provider-profile/driver-portrait/2026-10-09/00000000-0000-4000-8000-000000000001.jpg',100);
 if not exists(select 1 from driver_portrait_uploads where id=result and user_id=actor) then raise exception 'ACCEPTED_UPLOAD_UNAVAILABLE';end if;
 update profiles set active=false where id=actor;
 denied:=false;begin perform require_content_policy(actor);exception when others then if sqlerrm='FORBIDDEN' then denied:=true;else raise;end if;end;
 if not denied then raise exception 'ACCEPTANCE_RESTORED_AUTHORITY';end if;
 if has_table_privilege('authenticated','public.user_policy_acceptances','INSERT') or has_function_privilege('anon','public.accept_content_policy(uuid,text)','EXECUTE') then raise exception 'BROWSER_CONSENT_FORGERY';end if;
 delete from driver_portrait_uploads where user_id=actor;
 delete from audit_logs where actor_user_id=actor;
 delete from auth.users where id=actor;
 if exists(select 1 from user_policy_acceptances where user_id=actor) then raise exception 'ORPHANED_POLICY_ACCEPTANCE';end if;
 raise notice 'No invented consent, pre-upload denial, version binding, saved acceptance, inactive denial and browser isolation pass';
end $test$;
rollback;
