begin;
create function pg_temp.expect_provider_support_denied(command text,expected text) returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'EXPECTED_PROVIDER_SUPPORT_DENIAL: %',expected;
end $$;
do $test$
declare provider_id uuid;admin_id uuid;chat_id uuid;role_value text;guest_id uuid:=gen_random_uuid();digest text:=repeat('c',64);result jsonb;
begin
 select id into strict provider_id from public.profiles where active and role='DRIVER' limit 1;
 select id into strict admin_id from public.profiles where active and role='ADMIN' limit 1;
 -- The entire test rolls back; free this fixture's active-chat slot temporarily.
 update public.support_conversations set status='CLOSED' where customer_user_id=provider_id and status in ('OPEN','WAITING');
 foreach role_value in array array['DRIVER','TRANSPORTER'] loop
  update public.profiles set role=role_value::public.user_role where id=provider_id;
  chat_id:=public.create_managed_support_conversation(provider_id,'{"category":"ACCOUNT","body":"Provider-only regression"}');
  perform public.send_managed_support_message(provider_id,chat_id,'Provider follow-up');
  perform public.send_managed_support_message(admin_id,chat_id,'Staff reply');
  perform public.close_managed_support_conversation(provider_id,chat_id);
 end loop;
 foreach role_value in array array['SHIPPER','RECEIVER'] loop
  update public.profiles set role=role_value::public.user_role where id=provider_id;
  perform pg_temp.expect_provider_support_denied(format('select public.create_managed_support_conversation(%L,%L::jsonb)',provider_id,'{"category":"ACCOUNT","body":"Denied"}'),'FORBIDDEN');
  perform pg_temp.expect_provider_support_denied(format('select public.send_managed_support_message(%L,%L,''Denied'')',provider_id,chat_id),'NOT_FOUND');
  perform pg_temp.expect_provider_support_denied(format('select public.support_attachment_reply_scope(%L,%L)',provider_id,chat_id),'NOT_FOUND');
 end loop;
 insert into public.guest_support_conversations(id,email,email_digest,phone,status) values(guest_id,'retained@example.test',digest,'+251911000000','OPEN');
 insert into public.guest_support_messages(conversation_id,sender_kind,body) values(guest_id,'GUEST','Retained historical message');
 perform pg_temp.expect_provider_support_denied('select public.create_managed_guest_support(''{}''::jsonb)','PUBLIC_SUPPORT_CLOSED');
 perform pg_temp.expect_provider_support_denied(format('select public.send_managed_guest_support_message(null,%L,%L,''Denied'')',guest_id,digest),'PUBLIC_SUPPORT_CLOSED');
 result:=public.managed_guest_support_conversation(null,guest_id,digest,50,false);
 if jsonb_array_length(result->'messages')<>1 then raise exception 'HISTORY_LOST';end if;
 perform public.send_managed_guest_support_message(admin_id,guest_id,null,'Staff can finish an existing record');
 perform public.close_managed_guest_support(admin_id,guest_id,null);
 if has_function_privilege('anon','public.create_managed_guest_support(jsonb)','execute') or has_function_privilege('authenticated','public.create_managed_support_conversation(uuid,jsonb)','execute') then raise exception 'BROWSER_COMMAND_EXPOSED';end if;
 raise notice 'Provider and staff support preserved; guest/non-provider writes denied; retained history readable';
end $test$;
rollback;
