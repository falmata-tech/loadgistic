-- Local fixture database only; fixture status and all synthetic records roll back.
begin;
create function pg_temp.expect_attachment_denied(command text,expected text default 'NOT_FOUND') returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'EXPECTED_DENIAL';
end $$;
create function pg_temp.attachment_command() returns jsonb language sql as $$
 select jsonb_build_object('file_path','supabase://support-attachment/member-support/2026-09-14/'||gen_random_uuid()||'.png','original_name','test.png','mime_type','image/png','size_bytes',100);
$$;
do $test$
declare member uuid; agent uuid; outsider uuid; admin_id uuid; chat uuid:=gen_random_uuid(); other_chat uuid:=gen_random_uuid();
 upload uuid; abandoned uuid; pending uuid; message uuid; retry uuid; result jsonb; signature text; role_name text; n integer;
begin
 select id into strict member from profiles where email='driver@loadgistic.local';
 select id into strict agent from profiles where email='support@loadgistic.local';
 select id into strict outsider from profiles where email='transporter@loadgistic.local';
 select id into strict admin_id from profiles where email='admin@loadgistic.local';
 update support_conversations set status='CLOSED' where customer_user_id=member and status<>'CLOSED';
 insert into support_conversations(id,customer_user_id,assigned_agent_user_id,category,status) values(chat,member,agent,'ACCOUNT','OPEN'),(other_chat,outsider,null,'ACCOUNT','CLOSED');
 perform pg_temp.expect_attachment_denied(format('select reserve_support_attachment(%L,%L,pg_temp.attachment_command())',outsider,chat));
 upload:=reserve_support_attachment(member,chat,pg_temp.attachment_command());
 if support_attachment_file(member,chat,upload) is not null then raise exception 'PENDING_FILE_VISIBLE';end if;
 perform pg_temp.expect_attachment_denied(format('select send_support_attachment_message(%L,%L,%L,%L)',outsider,chat,upload,'Forbidden'));
 perform pg_temp.expect_attachment_denied(format('select send_support_attachment_message(%L,%L,%L,%L)',member,chat,upload,'  '),'INVALID_SUPPORT_MESSAGE');
 if exists(select 1 from support_messages where conversation_id=chat) then raise exception 'FAILED_SEND_CREATED_MESSAGE';end if;
 message:=send_support_attachment_message(member,chat,upload,'Member proof');
 retry:=send_support_attachment_message(member,chat,upload,'Member proof');
 if retry<>message or (select count(*) from support_messages where conversation_id=chat)<>1 then raise exception 'DUPLICATE_ATTACHMENT_MESSAGE';end if;
 if discard_support_attachment(member,upload) then raise exception 'ATTACHED_DISCARDED_AFTER_LOST_RESPONSE';end if;
 if support_attachment_file(member,chat,upload) is null or support_attachment_file(agent,chat,upload) is null or support_attachment_file(admin_id,chat,upload) is null then raise exception 'AUTHORIZED_FILE_MISSING';end if;
 if support_attachment_file(outsider,chat,upload) is not null or support_attachment_file(null,chat,upload) is not null or support_attachment_file(member,other_chat,upload) is not null then raise exception 'UNAUTHORIZED_FILE_VISIBLE';end if;
 result:=managed_support_conversation(member,chat,50,false);
 if result->'messages'->0->>'attachment_id'<>upload::text or result::text like '%supabase://%' then raise exception 'UNSAFE_LATEST_PROJECTION';end if;
 update support_agent_profiles set can_manage_support=false where user_id=agent;
 if support_attachment_file(agent,chat,upload) is not null then raise exception 'REVOKED_SUPPORT_PERMISSION_READ';end if;
 perform pg_temp.expect_attachment_denied(format('select reserve_support_attachment(%L,%L,pg_temp.attachment_command())',agent,chat));
 update support_agent_profiles set can_manage_support=true,active=false where user_id=agent;
 if support_attachment_file(agent,chat,upload) is not null then raise exception 'INACTIVE_SUPPORT_READ';end if;
 update support_agent_profiles set active=true where user_id=agent;
 -- A reserved staff upload loses write/read authority immediately after reassignment.
 abandoned:=reserve_support_attachment(agent,chat,pg_temp.attachment_command());
 update support_conversations set assigned_agent_user_id=null,status='WAITING' where id=chat;
 perform pg_temp.expect_attachment_denied(format('select send_support_attachment_message(%L,%L,%L,%L)',agent,chat,abandoned,'No longer assigned'));
 perform pg_temp.expect_attachment_denied(format('select reserve_support_attachment(%L,%L,pg_temp.attachment_command())',agent,chat));
 if support_attachment_file(agent,chat,upload) is not null then raise exception 'REASSIGNED_AGENT_FILE_VISIBLE';end if;
 perform discard_support_attachment(agent,abandoned,true);
 if not exists(select 1 from claim_support_attachment_cleanup(1) where id=abandoned) then raise exception 'FAILED_UPLOAD_NOT_CLAIMED';end if;
 if exists(select 1 from claim_support_attachment_cleanup(20) where id=abandoned) then raise exception 'CLEANUP_DOUBLE_CLAIM';end if;
 update support_attachments set updated_at=now()-interval '6 minutes' where id=abandoned;
 if not exists(select 1 from claim_support_attachment_cleanup(20) where id=abandoned) then raise exception 'CLEANUP_RETRY_MISSING';end if;
 -- An unacknowledged Storage write must survive immediate cleanup to allow late arrival.
 pending:=reserve_support_attachment(member,chat,pg_temp.attachment_command());
 perform discard_support_attachment(member,pending);
 if exists(select 1 from claim_support_attachment_cleanup(20) where id=pending) then raise exception 'AMBIGUOUS_UPLOAD_CLEANED_TOO_EARLY';end if;
 update support_attachments set updated_at=now()-interval '2 hours' where id=pending;
 if not exists(select 1 from claim_support_attachment_cleanup(20) where id=pending) then raise exception 'RETIRED_GRACE_CLEANUP_MISSING';end if;
 pending:=reserve_support_attachment(member,chat,pg_temp.attachment_command());
 update profiles set active=false where id=member;
 perform pg_temp.expect_attachment_denied(format('select send_support_attachment_message(%L,%L,%L,%L)',member,chat,pending,'Inactive'));
 if support_attachment_file(member,chat,upload) is not null then raise exception 'INACTIVE_READ';end if;
 update profiles set active=true where id=member;
 update support_conversations set status='CLOSED',assigned_agent_user_id=agent where id=chat;
 perform pg_temp.expect_attachment_denied(format('select send_support_attachment_message(%L,%L,%L,%L)',member,chat,pending,'Closed'),'SUPPORT_CONVERSATION_CLOSED');
 if support_attachment_file(member,chat,upload) is null or support_attachment_file(agent,chat,upload) is null then raise exception 'CLOSED_ATTACHMENT_LOST';end if;
 update support_attachments set updated_at=now()-interval '2 hours' where id=pending;
 if not exists(select 1 from claim_support_attachment_cleanup(999) where id=pending) then raise exception 'STALE_UPLOAD_NOT_CLAIMED';end if;
 if (select state from support_attachments where id=upload)<>'ATTACHED' then raise exception 'ATTACHED_CLEANED';end if;
 insert into support_messages(conversation_id,sender_user_id,body,created_at) select chat,member,'Later history '||i,now()+i*interval '1 second' from generate_series(1,55)i;
 result:=managed_support_history(member,chat,null,50);
 result:=managed_support_history(member,chat,(result->>'next_before')::uuid,50);
 if result->'messages'->0->>'attachment_id'<>upload::text or result::text like '%supabase://%' then raise exception 'UNSAFE_HISTORY_PROJECTION';end if;
 -- Bound reservations independently of message sends.
 update support_conversations set status='OPEN' where id=chat;
 for n in 1..5 loop perform reserve_support_attachment(admin_id,chat,pg_temp.attachment_command());end loop;
 perform pg_temp.expect_attachment_denied(format('select reserve_support_attachment(%L,%L,pg_temp.attachment_command())',admin_id,chat),'SUPPORT_UPLOAD_BUSY');
 foreach role_name in array array['anon','authenticated'] loop
  if has_table_privilege(role_name,'public.support_attachments','SELECT,INSERT,UPDATE,DELETE') then raise exception 'DIRECT_ATTACHMENT_ACCESS';end if;
  foreach signature in array array['support_attachment_reply_scope(uuid,uuid)','reserve_support_attachment(uuid,uuid,jsonb)','send_support_attachment_message(uuid,uuid,uuid,text)','discard_support_attachment(uuid,uuid,boolean)','support_attachment_file(uuid,uuid,uuid)','claim_support_attachment_cleanup(integer)'] loop
   if has_function_privilege(role_name,'public.'||signature,'EXECUTE') then raise exception 'DIRECT_RPC_ACCESS';end if;
  end loop;
 end loop;
 raise notice 'Member attachment authorization, atomic send, history, cleanup and service-only boundaries passed';
end $test$;
rollback;
