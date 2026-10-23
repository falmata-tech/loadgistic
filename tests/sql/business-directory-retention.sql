begin;
do $test$
declare owner_id uuid:=gen_random_uuid();staff_id uuid:=gen_random_uuid();reader_id uuid:=gen_random_uuid();workspace uuid;invitation uuid;result jsonb;member jsonb;version_value bigint;uid uuid;
begin
 foreach uid in array array[owner_id,staff_id,reader_id] loop
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(uid,'synthetic-retention-'||uid||'@example.test',now(),'{}');
 end loop;
 update public.profiles set active=true,role='DRIVER' where id in(owner_id,reader_id);
 workspace:=(public.business_workspace_create(owner_id,jsonb_build_object('name','Synthetic retained team','handle','retained-team-'||substr(owner_id::text,1,12),'kind','BROKER'))->>'id')::uuid;
 version_value:=1;
 foreach uid in array array[staff_id,reader_id] loop
  invitation:=(public.business_workspace_command(owner_id,workspace,jsonb_build_object('action','INVITE','expectedVersion',version_value,'email','synthetic-retention-'||uid||'@example.test','role','STAFF','capacity',true,'tracking',true))->>'invitationId')::uuid;
  perform public.business_workspace_accept_invitation(uid,invitation);
  select version into version_value from public.business_workspaces where id=workspace;
 end loop;
 update public.profiles set first_name='Private deleted first name',full_name='Private deleted identity' where id=staff_id;
 update auth.users set deleted_at=now(),email=null where id=staff_id;
 result:=public.business_workspace_directory(owner_id,workspace);
 select value into member from jsonb_array_elements(result->'members') where value->>'userId'=staff_id::text;
 if member is null or member->>'firstName'<>'Former team member' or member->>'erased'<>'true' or member ? 'email' or (member->>'active')::boolean then raise exception 'ERASED_TEAM_MEMBER_PRIVACY_OR_NULL_EMAIL_FAILURE'; end if;
 if jsonb_array_length(result->'members')<>3 or not exists(select 1 from jsonb_array_elements(result->'members') m where m->>'userId'=reader_id::text and m ? 'email') then raise exception 'OTHER_TEAM_MEMBERS_CHANGED'; end if;
 result:=public.business_workspace_directory(reader_id,workspace);
 if exists(select 1 from jsonb_array_elements(result->'members') m where m ? 'email') then raise exception 'ORDINARY_STAFF_CONTACT_DISCLOSURE'; end if;
 if public.business_workspace_permission(staff_id,workspace,'ACCESS') or not public.business_workspace_permission(owner_id,workspace,'OWNER') then raise exception 'RETENTION_CHANGED_AUTHORITY'; end if;
 raise notice 'PASS: erased member pseudonym, null-email renderability, active colleague preservation, ordinary-staff privacy, unchanged authorization';
end $test$;
rollback;
