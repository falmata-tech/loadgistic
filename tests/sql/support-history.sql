-- Local fixture database only. All synthetic records and permission changes roll back.
begin;
create function pg_temp.expect_history_denied(command text,expected text default 'NOT_FOUND') returns void language plpgsql as $$
begin
  begin execute command; exception when others then
    if sqlerrm=expected then return;end if;raise;
  end;
  raise exception 'EXPECTED_DENIAL';
end;
$$;
do $test$
declare member_id uuid; outsider_id uuid; agent_id uuid; admin_id uuid;
  member_chat uuid:=gen_random_uuid(); guest_chat uuid:=gen_random_uuid(); other_chat uuid:=gen_random_uuid();
  attachment_id uuid:=gen_random_uuid(); digest text:=repeat('a',64); result jsonb; first_page jsonb;
  cursor_id uuid; second_cursor uuid; ids uuid[]; kind text; args text; n integer;
begin
  select id into strict member_id from profiles where email='driver@loadgistic.local';
  select id into strict outsider_id from profiles where email='transporter@loadgistic.local';
  select id into strict agent_id from profiles where email='support@loadgistic.local';
  select id into strict admin_id from profiles where email='admin@loadgistic.local';
  insert into support_conversations(id,customer_user_id,assigned_agent_user_id,category,status)
    values(member_chat,member_id,agent_id,'ACCOUNT','CLOSED');
  insert into guest_support_conversations(id,email,email_digest,phone,status,assigned_agent_user_id)
    values(guest_chat,'history@example.test',digest,'+251911000000','OPEN',agent_id),
      (other_chat,'other-history@example.test',repeat('b',64),'+251911000001','WAITING',null);
  insert into support_messages(id,conversation_id,sender_user_id,body,created_at)
    select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,member_chat,member_id,'Member history '||i,'2026-01-01'::timestamptz from generate_series(1,121)i;
  insert into guest_support_messages(id,conversation_id,sender_kind,body,created_at)
    select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,guest_chat,'GUEST','Guest history '||i,'2026-01-01'::timestamptz from generate_series(1,121)i;
  insert into guest_support_attachments(id,conversation_id,message_id,file_path,original_name,mime_type,size_bytes)
    values(attachment_id,guest_chat,'00000000-0000-0000-0000-000000000030','supabase://support-attachment/test-history.png','history.png','image/png',100);

  foreach kind in array array['support','guest_support'] loop
    args:=case when kind='support' then format('%L,%L',member_id,member_chat) else format('null,%L',guest_chat) end;
    execute format('select managed_%s_history(%s,null,500%s)',kind,args,case when kind='guest_support' then format(',%L',digest) else '' end) into result;
    if jsonb_array_length(result->'messages')<>50 or result->'messages'->0->>'body' not like '%72' then raise exception 'LATEST_WINDOW_ORDER';end if;
    cursor_id:=(result->>'next_before')::uuid;
    execute format('select managed_%s_history(%s,%L,50%s)',kind,args,cursor_id,case when kind='guest_support' then format(',%L',digest) else '' end) into first_page;
    if jsonb_array_length(first_page->'messages')<>50 or first_page->'messages'->0->>'body' not like '%22' then raise exception 'HISTORY_ORDER';end if;
    if first_page::text like '%supabase://%' or first_page::text like '%email_digest%' then raise exception 'PRIVATE_METADATA_LEAK';end if;
    second_cursor:=(first_page->>'next_before')::uuid;
    execute format('select managed_%s_history(%s,%L,50%s)',kind,args,second_cursor,case when kind='guest_support' then format(',%L',digest) else '' end) into result;
    if jsonb_array_length(result->'messages')<>21 or (result->>'has_older')::boolean or result->>'next_before' is not null then raise exception 'TERMINAL_HISTORY';end if;
  end loop;
  -- New replies do not move the preceding window, including equal timestamps.
  insert into guest_support_messages(conversation_id,sender_kind,body) values(guest_chat,'TEAM','New reply');
  result:=managed_guest_support_history(null,guest_chat,cursor_id,50,digest);
  if result->'messages'<>first_page->'messages' then raise exception 'UNSTABLE_CURSOR';end if;
  if (select guest_last_read_at from guest_support_conversations where id=guest_chat) is not null then raise exception 'HISTORY_MARKED_READ';end if;
  perform managed_support_history(agent_id,member_chat,cursor_id,50);
  perform managed_support_history(admin_id,member_chat,cursor_id,50);
  perform managed_guest_support_history(agent_id,guest_chat,cursor_id,50,null);
  perform managed_guest_support_history(admin_id,guest_chat,cursor_id,50,null);
  perform pg_temp.expect_history_denied(format('select managed_support_history(%L,%L,null,50)',outsider_id,member_chat));
  perform pg_temp.expect_history_denied(format('select managed_guest_support_history(null,%L,null,50,%L)',guest_chat,repeat('b',64)));
  perform pg_temp.expect_history_denied(format('select managed_guest_support_history(null,%L,%L,50,%L)',other_chat,cursor_id,repeat('b',64)),'INVALID_SUPPORT_CURSOR');
  perform pg_temp.expect_history_denied(format('select managed_support_history(%L,%L,%L,50)',member_id,member_chat,gen_random_uuid()),'INVALID_SUPPORT_CURSOR');
  update profiles set active=false where id=member_id;
  perform pg_temp.expect_history_denied(format('select managed_support_history(%L,%L,null,50)',member_id,member_chat));
  update profiles set active=true where id=member_id;
  update guest_support_conversations set status='WAITING',assigned_agent_user_id=null where id=guest_chat;
  select count(*) into n from guest_support_events where conversation_id=guest_chat;
  perform pg_temp.expect_history_denied(format('select managed_guest_support_conversation(%L,%L,null,50,true)',agent_id,guest_chat));
  perform pg_temp.expect_history_denied(format('select managed_guest_support_history(%L,%L,null,50,null)',agent_id,guest_chat));
  perform pg_temp.expect_history_denied(format('select send_managed_guest_support_message(%L,%L,null,%L)',agent_id,guest_chat,'Forbidden reply'));
  perform pg_temp.expect_history_denied(format('select close_managed_guest_support(%L,%L,null)',agent_id,guest_chat));
  perform pg_temp.expect_history_denied(format('select managed_guest_support_attachment_file(%L,%L,%L,null)',agent_id,guest_chat,attachment_id));
  if (select count(*) from guest_support_events where conversation_id=guest_chat)<>n or
    (select agent_last_read_at from guest_support_conversations where id=guest_chat) is not null then raise exception 'DENIED_SIDE_EFFECT';end if;
  if managed_guest_support_attachment_file(null,guest_chat,attachment_id,digest) is null then raise exception 'GUEST_ATTACHMENT_LOST';end if;
  update guest_support_conversations set status='CLOSED' where id=guest_chat;
  perform managed_guest_support_history(null,guest_chat,cursor_id,50,digest);
  update guest_support_conversations set status='OPEN',assigned_agent_user_id=agent_id where id=guest_chat;
  perform send_managed_guest_support_message(agent_id,guest_chat,null,'Permitted assigned reply');
  perform close_managed_guest_support(agent_id,guest_chat,null);
  if (select status from guest_support_conversations where id=guest_chat)<>'CLOSED' then raise exception 'ASSIGNED_CLOSE_FAILED';end if;
  update support_agent_profiles set can_manage_support=false where user_id=agent_id;
  perform pg_temp.expect_history_denied(format('select managed_support_history(%L,%L,null,50)',agent_id,member_chat));
  if has_function_privilege('anon','public.managed_support_history(uuid,uuid,uuid,integer)','execute')
    or has_function_privilege('authenticated','public.managed_support_history(uuid,uuid,uuid,integer)','execute')
    or has_function_privilege('anon','public.managed_guest_support_history(uuid,uuid,uuid,integer,text)','execute')
    or has_function_privilege('authenticated','public.managed_guest_support_history(uuid,uuid,uuid,integer,text)','execute') then raise exception 'BROWSER_RPC_ACCESS';end if;
end;
$test$;
rollback;
