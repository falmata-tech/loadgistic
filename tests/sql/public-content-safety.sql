begin;
do $test$
declare actor uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();report uuid;report_again uuid;handle text:='safety-'||provider;blocked jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(actor,'content-synthetic@example.test',now(),'{"full_name":"Synthetic provider"}'),(admin_id,'content-admin@example.test',now(),'{"full_name":"Synthetic moderator"}');
 insert into profiles(id,email,full_name,role,active) values(actor,'content-synthetic@example.test','Synthetic provider','DRIVER',true),(admin_id,'content-admin@example.test','Synthetic moderator','ADMIN',true) on conflict(id) do update set role=excluded.role,active=true;
 insert into provider_profiles(id,user_id,business_name,handle,public_visibility) values(provider,actor,'Synthetic content provider',handle,'PUBLIC');
 insert into company_pages(provider_profile_id,published,about) values(provider,true,'Synthetic public description');
 update company_pages set published=false where provider_profile_id=provider;
 begin perform submit_content_report(handle,repeat('c',64),'PROFILE','An unpublished target must not be disclosed.');raise exception 'UNPUBLISHED_REPORT_TARGET';exception when others then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 update company_pages set published=true where provider_profile_id=provider;
 report:=submit_content_report(handle,repeat('a',64),'PROFILE','A synthetic moderation report.');
 report_again:=submit_content_report(handle,repeat('a',64),'PROFILE','A duplicate retry.');
 if report is null or report_again<>report then raise exception 'REPORT_NOT_IDEMPOTENT';end if;
 begin perform moderate_content_report(actor,report,'HIDE','Investigated synthetic content.');raise exception 'NONSTAFF_MODERATION';exception when others then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 perform moderate_content_report(admin_id,report,'HIDE','Investigated synthetic content.');
 if not(select content_hidden from provider_profiles where id=provider) or(select public_visibility from provider_profiles where id=provider)<>'PRIVATE' then raise exception 'CONTENT_NOT_HIDDEN';end if;
 update provider_profiles set public_visibility='PUBLIC' where id=provider;
 if(select public_visibility from provider_profiles where id=provider)<>'PRIVATE' then raise exception 'REPUBLISH_BYPASSED_MODERATION';end if;
 perform moderate_content_report(admin_id,report,'RESTORE','Replacement content has been reviewed.');
 if(select content_hidden from provider_profiles where id=provider) or(select public_visibility from provider_profiles where id=provider)<>'PUBLIC' or not(select published from company_pages where provider_profile_id=provider) then raise exception 'CONTENT_NOT_RESTORED';end if;
 blocked:=jsonb_build_object('blocked_handles',jsonb_build_array(handle));
 if capacity_search_matches(jsonb_build_object('provider_handle',handle),blocked) then raise exception 'BLOCKED_SEARCH_MATCH';end if;
 if not capacity_search_matches(jsonb_build_object('provider_handle','unrelated-provider'),blocked) then raise exception 'UNRELATED_SEARCH_BLOCKED';end if;
 if has_table_privilege('anon','public.content_reports','SELECT') or has_function_privilege('authenticated','public.moderate_content_report(uuid,uuid,text,text)','EXECUTE') then raise exception 'BROWSER_MODERATION_ACCESS';end if;
 raise notice 'Reports/deduplication, staff scope, durable hide/restore, pre-pagination blocks and browser denial pass';
end $test$;
rollback;
