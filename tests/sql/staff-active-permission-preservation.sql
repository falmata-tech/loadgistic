-- FEAT-ADM-001: synthetic staff activation fixtures; every write rolls back.
begin;
create function pg_temp.assert_staff_active(ok boolean,message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception '%',message;end if;end $$;
create function pg_temp.staff_active_denied(statement text,expected text default 'FORBIDDEN') returns void language plpgsql as $$
begin begin execute statement;raise exception 'STAFF_ACTIVE_UNEXPECTEDLY_ALLOWED';
 exception when raise_exception then if sqlerrm<>expected then raise;end if;end;end $$;
do $test$
declare admin_id uuid:=gen_random_uuid();staff_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();customer_id uuid:=gen_random_uuid();
 member_chat uuid:=gen_random_uuid();guest_chat uuid:=gen_random_uuid();uid uuid;before_staff jsonb;before_person jsonb;before_other jsonb;before_messages jsonb;result jsonb;before_audits bigint;
begin
 foreach uid in array array[admin_id,staff_id,other_id,customer_id] loop
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(uid,'staff-active-'||uid||'@example.test',now(),'{}');
 end loop;
 update profiles set role='ADMIN',active=true,full_name='Synthetic private administrator' where id=admin_id;
 update profiles set role='SUPPORT',active=true,full_name='Synthetic private staff' where id in(staff_id,other_id);
 update profiles set role='DRIVER',active=true,full_name='Synthetic private customer' where id=customer_id;
 insert into support_agent_profiles(user_id,active,available,max_open_conversations,can_manage_customers,can_manage_operations,can_manage_trust,can_manage_billing,can_manage_support,can_manage_brokerage,can_manage_featured)
 values(staff_id,true,true,7,true,true,true,true,true,false,true),(other_id,true,false,3,true,false,false,false,false,false,true);
 insert into support_conversations(id,customer_user_id,assigned_agent_user_id,category,status) values(member_chat,customer_id,staff_id,'ACCOUNT','OPEN');
 insert into guest_support_conversations(id,email,email_digest,phone,status,assigned_agent_user_id) values(guest_chat,'synthetic-guest@example.test',repeat('c',64),'+251900000142','OPEN',staff_id);
 insert into support_messages(conversation_id,sender_user_id,body) values(member_chat,customer_id,'Synthetic retained member message');
 insert into guest_support_messages(conversation_id,sender_kind,body) values(guest_chat,'GUEST','Synthetic retained guest message');
 before_messages:=jsonb_build_object('member',(select jsonb_agg(to_jsonb(m) order by m.id) from support_messages m where conversation_id=member_chat),'guest',(select jsonb_agg(to_jsonb(m) order by m.id) from guest_support_messages m where conversation_id=guest_chat));
 before_staff:=(select to_jsonb(s)-array['active','available','updated_at'] from support_agent_profiles s where user_id=staff_id);
 before_person:=(select to_jsonb(p)-'active' from profiles p where id=staff_id);
 before_other:=(select to_jsonb(s) from support_agent_profiles s where user_id=other_id);
 perform pg_temp.staff_active_denied(format('update support_agent_profiles set can_manage_brokerage=true where user_id=%L',staff_id),'PLATFORM_BROKERAGE_RETIRED');
 perform pg_temp.assert_staff_active((select to_jsonb(s)-array['active','available','updated_at'] from support_agent_profiles s where user_id=staff_id)=before_staff,'RETIRED_BROKERAGE_GRANT_CHANGED_STAFF');
 result:=managed_admin_record_command(admin_id,'USER',staff_id,'{"action":"SET_ACTIVE","active":false}');
 perform pg_temp.assert_staff_active(result->>'updated'='true','STAFF_SUSPEND_RESULT_WRONG');
 -- Suspension must not reset any active responsibility.
 perform pg_temp.assert_staff_active((select to_jsonb(s)-array['active','available','updated_at'] from support_agent_profiles s where user_id=staff_id)=before_staff,'STAFF_ACTIVE_CHANGE_ERASED_EXISTING_PERMISSION');
 perform pg_temp.assert_staff_active((select not active and not available from support_agent_profiles where user_id=staff_id) and(select not active from profiles where id=staff_id),'STAFF_SUSPEND_STATE_WRONG');
 perform pg_temp.assert_staff_active((select to_jsonb(p)-'active' from profiles p where id=staff_id)=before_person,'STAFF_ROLE_OR_PRIVATE_IDENTITY_CHANGED');
 perform pg_temp.assert_staff_active((select assigned_agent_user_id is distinct from staff_id and status in('WAITING','OPEN') from support_conversations where id=member_chat) and(select assigned_agent_user_id is distinct from staff_id and status in('WAITING','OPEN') from guest_support_conversations where id=guest_chat),'DISABLED_STAFF_RETAINED_CHAT');
 perform pg_temp.assert_staff_active((select count(*)=1 from support_events where conversation_id=member_chat and event_type='REQUEUED' and actor_user_id=admin_id) and(select count(*)=1 from guest_support_events where conversation_id=guest_chat and event_type='REQUEUED' and actor_user_id=admin_id),'STAFF_REQUEUE_ATTRIBUTION_WRONG');
 perform pg_temp.assert_staff_active((select count(*)=1 from audit_logs where action='SUPPORT_AGENT_UPDATED' and entity_id=staff_id and actor_user_id=admin_id and details->>'active'='false'),'STAFF_SUSPEND_AUDIT_WRONG');
 perform managed_admin_record_command(admin_id,'USER',staff_id,'{"action":"SET_ACTIVE","active":true}');
 perform pg_temp.assert_staff_active((select to_jsonb(s)-array['active','available','updated_at'] from support_agent_profiles s where user_id=staff_id)=before_staff,'STAFF_RESTORE_ERASED_EXISTING_PERMISSION');
 perform pg_temp.assert_staff_active((select active and not available from support_agent_profiles where user_id=staff_id) and(select active from profiles where id=staff_id),'STAFF_RESTORE_AVAILABILITY_INVENTED');
 perform pg_temp.assert_staff_active((select to_jsonb(s) from support_agent_profiles s where user_id=other_id)=before_other,'UNRELATED_STAFF_CHANGED');
 perform pg_temp.assert_staff_active((select count(*)=2 from audit_logs where action='SUPPORT_AGENT_UPDATED' and entity_id=staff_id and actor_user_id=admin_id),'STAFF_ACTIVE_AUDIT_MISSING_OR_DUPLICATED');
 perform pg_temp.assert_staff_active(jsonb_build_object('member',(select jsonb_agg(to_jsonb(m) order by m.id) from support_messages m where conversation_id=member_chat),'guest',(select jsonb_agg(to_jsonb(m) order by m.id) from guest_support_messages m where conversation_id=guest_chat))=before_messages,'STAFF_ACTIVE_DELETED_OR_REWROTE_HISTORY');
 select count(*) into before_audits from audit_logs;
 foreach uid in array array[other_id,customer_id,null::uuid] loop
  perform pg_temp.staff_active_denied(format('select managed_admin_record_command(%L,''USER'',%L,''{"action":"SET_ACTIVE","active":false}''::jsonb)',uid,staff_id));
 end loop;
 perform pg_temp.staff_active_denied(format('select managed_admin_record_command(%L,''USER'',%L,''{"action":"SET_ACTIVE","active":false}''::jsonb)',admin_id,admin_id),'ADMIN_SELF_SUSPENSION_DENIED');
 perform pg_temp.staff_active_denied(format('select managed_admin_record_command(%L,''DRIVER'',%L,''{"action":"SET_ACTIVE","active":false}''::jsonb)',admin_id,staff_id),'INVALID_ADMIN_RECORD_TYPE');
 update profiles set active=false where id=admin_id;
 perform pg_temp.staff_active_denied(format('select managed_admin_record_command(%L,''USER'',%L,''{"action":"SET_ACTIVE","active":false}''::jsonb)',admin_id,staff_id));
 perform pg_temp.assert_staff_active((select count(*) from audit_logs)=before_audits and(select active from profiles where id=staff_id),'DENIED_STAFF_COMMAND_MUTATED_STATE');
 perform pg_temp.assert_staff_active(not has_function_privilege('anon','public.managed_admin_record_command(uuid,text,uuid,jsonb)','EXECUTE') and not has_function_privilege('authenticated','public.managed_admin_record_command(uuid,text,uuid,jsonb)','EXECUTE'),'STAFF_ACTIVE_BROWSER_RPC_EXPOSED');
 raise notice 'PASS: active staff permissions retained, retired Brokerage grant denied, existing chat requeue, private identity, audit and actor denial';
end $test$;
rollback;
