begin;
create function pg_temp.expect_poll_denied(command text) returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlerrm='NOT_FOUND' then return;end if;raise;end;raise exception 'EXPECTED_DENIAL';end $$;
do $test$
declare member_id uuid; agent_id uuid; outsider uuid; chat uuid:=gen_random_uuid(); guest_chat uuid:=gen_random_uuid(); revision text; next_revision text;
begin
 select id into strict member_id from profiles where email='driver@loadgistic.local';
 select id into strict outsider from profiles where email='transporter@loadgistic.local';
 select id into strict agent_id from profiles where email='support@loadgistic.local';
 insert into support_conversations(id,customer_user_id,assigned_agent_user_id,category,status) values(chat,member_id,agent_id,'ACCOUNT','CLOSED');
 insert into guest_support_conversations(id,email,email_digest,phone,status,assigned_agent_user_id) values(guest_chat,'poll@example.test',repeat('a',64),'+251911000000','OPEN',agent_id);
 revision:=support_conversation_revision(member_id,chat,false);
 if revision is distinct from support_conversation_revision(member_id,chat,false) then raise exception 'UNCHANGED_REVISION';end if;
 perform pg_temp.expect_poll_denied(format('select support_conversation_revision(%L,%L,false)',outsider,chat));
 insert into support_messages(conversation_id,sender_user_id,body) values(chat,member_id,'Private poll regression');
 next_revision:=support_conversation_revision(member_id,chat,false);
 if revision=next_revision then raise exception 'MESSAGE_NOT_DETECTED';end if;
 update support_conversations set customer_last_read_at=now() where id=chat;
 if next_revision is distinct from support_conversation_revision(member_id,chat,false) then raise exception 'READ_RECEIPT_REFRESH_LOOP';end if;
 revision:=support_conversation_revision(null,guest_chat,true,repeat('a',64));
 perform pg_temp.expect_poll_denied(format('select support_conversation_revision(null,%L,true,%L)',guest_chat,repeat('b',64)));
 perform support_conversation_revision(agent_id,guest_chat,true);
 update guest_support_conversations set assigned_agent_user_id=null,status='WAITING' where id=guest_chat;
 if revision=support_conversation_revision(null,guest_chat,true,repeat('a',64)) then raise exception 'ASSIGNMENT_NOT_DETECTED';end if;
 perform pg_temp.expect_poll_denied(format('select support_conversation_revision(%L,%L,true)',agent_id,guest_chat));
 update support_agent_profiles set can_manage_support=false where user_id=agent_id;
 perform pg_temp.expect_poll_denied(format('select support_conversation_revision(%L,%L,false)',agent_id,chat));
 update profiles set active=false where id=member_id;
 perform pg_temp.expect_poll_denied(format('select support_conversation_revision(%L,%L,false)',member_id,chat));
 if has_function_privilege('authenticated','public.support_conversation_revision(uuid,uuid,boolean,text,boolean)','execute') or has_function_privilege('anon','public.support_conversation_revision(uuid,uuid,boolean,text,boolean)','execute') then raise exception 'BROWSER_REVISION_RPC';end if;
 raise notice 'Support conditional revision, message, assignment and current-authority tests passed';
end $test$;
rollback;
