-- FEAT-ENT/NOT-001. Synthetic rollback-only acceptance; no vendor delivery.
begin;
create function pg_temp.expect_business_push_denied(statement text,expected text default 'FORBIDDEN')
returns void language plpgsql as $$
begin
 begin execute statement;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'BUSINESS_PUSH_EXPECTED_DENIAL_%',expected;
end $$;
create function pg_temp.register_business_push(actor uuid,session uuid,installation uuid,token_suffix text)
returns boolean language sql as $$
 select public.register_native_push_binding(installation,repeat('a',64),'ExpoPushToken[synthetic-'||token_suffix||']','en',actor,session,null,null)
$$;
do $test$
declare owner_id uuid:=gen_random_uuid();staff_id uuid:=gen_random_uuid();bare_id uuid:=gen_random_uuid();provider_id uuid:=gen_random_uuid();
 admin_id uuid:=gen_random_uuid();support_id uuid:=gen_random_uuid();unverified_id uuid:=gen_random_uuid();uid uuid;user_session uuid;
 staff_session uuid:=gen_random_uuid();provider_session uuid:=gen_random_uuid();foreign_session uuid:=gen_random_uuid();
 workspace uuid;invitation uuid;version_value bigint;binding uuid;installation uuid:=gen_random_uuid();provider_installation uuid:=gen_random_uuid();
 chat uuid:=gen_random_uuid();other_chat uuid:=gen_random_uuid();delivery uuid;worker uuid:=gen_random_uuid();value jsonb;read_before jsonb;
 index_value integer;role_name text;signature text;
begin
 foreach uid in array array[owner_id,staff_id,bare_id,provider_id,admin_id,support_id,unverified_id] loop
  insert into auth.users(id,email,email_confirmed_at) values(uid,'synthetic-business-push-'||uid||'@example.test',case when uid=unverified_id then null else now() end);
  update public.profiles set active=true,role='SHIPPER' where id=uid;
  insert into auth.sessions(id,user_id,created_at,updated_at) values(gen_random_uuid(),uid,now(),now());
 end loop;
 update public.profiles set role='DRIVER' where id=provider_id;
 update public.profiles set role='ADMIN' where id=admin_id;
 update public.profiles set role='SUPPORT' where id=support_id;
 insert into public.support_agent_profiles(user_id,active,available,max_open_conversations,can_manage_support,can_manage_brokerage)
 values(support_id,true,true,20,true,false);
 insert into auth.sessions(id,user_id,created_at,updated_at) values(staff_session,staff_id,now(),now()),(provider_session,provider_id,now(),now()),(foreign_session,bare_id,now(),now());
 workspace:=(public.business_workspace_create(owner_id,jsonb_build_object('name','Synthetic push business','handle','push-'||substr(owner_id::text,1,12),'kind','BROKER'))->>'id')::uuid;
 select version into version_value from public.business_workspaces where id=workspace;
 invitation:=(public.business_workspace_command(owner_id,workspace,jsonb_build_object('action','INVITE','expectedVersion',version_value,'email','synthetic-business-push-'||staff_id||'@example.test','role','STAFF','capacity',false,'tracking',false))->>'invitationId')::uuid;
 perform public.business_workspace_accept_invitation(staff_id,invitation);
 -- Even a legacy row forged with valid-looking membership cannot turn a
 -- platform or unverified identity into a mobile customer.
 insert into public.business_workspace_members(workspace_id,user_id,role,active,can_view_capacity,can_view_tracking)
 values(workspace,admin_id,'STAFF',true,true,true),(workspace,support_id,'STAFF',true,true,true),(workspace,unverified_id,'STAFF',true,true,true);
 foreach uid in array array[bare_id,admin_id,support_id,unverified_id] loop
  select id into strict user_session from auth.sessions where user_id=uid limit 1;
  perform pg_temp.expect_business_push_denied(format('select pg_temp.register_business_push(%L,%L,%L,%L)',uid,user_session,gen_random_uuid(),'denied-'||uid));
 end loop;
 perform pg_temp.expect_business_push_denied(format('select pg_temp.register_business_push(%L,%L,%L,%L)',staff_id,foreign_session,gen_random_uuid(),'foreign-session'));
 perform pg_temp.expect_business_push_denied(format('select public.register_native_push_binding(%L,%L,%L,''en'',null,null,%L,%L)',gen_random_uuid(),repeat('a',64),'ExpoPushToken[synthetic-retired-guest]',gen_random_uuid(),repeat('b',64)));

 -- Normal verified providers retain their previous basis. Capacity/Tracking
 -- checkboxes are not prerequisites for a customer's own software Support.
 perform pg_temp.register_business_push(provider_id,provider_session,provider_installation,'provider-preserved');
 perform pg_temp.register_business_push(staff_id,staff_session,installation,'customer-member');
 select id into strict binding from public.native_push_bindings where installation_id=installation;
 if not public.native_push_binding_active(binding) then raise exception 'BUSINESS_PUSH_ACTIVE_MEMBER_REJECTED';end if;
 perform public.business_workspace_select(staff_id,null);
 if not public.native_push_binding_active(binding) then raise exception 'PRESENTATION_SELECTION_REVOKED_OWN_SUPPORT_PUSH';end if;
 perform pg_temp.expect_business_push_denied(format('select public.register_native_push_binding(%L,%L,%L,''en'',%L,%L,null,null)',installation,repeat('f',64),'ExpoPushToken[synthetic-wrong-secret]',staff_id,staff_session));

 insert into public.support_conversations(id,customer_user_id,assigned_agent_user_id,category,status,assigned_at)
 values(chat,staff_id,support_id,'ACCOUNT','OPEN',clock_timestamp()),(other_chat,owner_id,support_id,'ACCOUNT','OPEN',clock_timestamp());
 insert into public.support_messages(conversation_id,sender_user_id,body)
 values(chat,support_id,'Synthetic private support message'),(other_chat,support_id,'Other customer private message');
 select id into strict delivery from public.native_push_outbox where binding_id=binding and source_id=chat and event='MESSAGE';
 if exists(select 1 from public.native_push_outbox where binding_id=binding and source_id=other_chat) then raise exception 'TEAMMATE_CHAT_PUSH_LEAK';end if;
 read_before:=public.chat_read_state('SUPPORT',chat,staff_id);
 -- Lease only the exact synthetic outbox item; no network or unrelated queue.
 update public.native_push_outbox set state='SENDING',lease_id=worker,leased_until=now()+interval '2 minutes' where id=delivery;
 value:=public.native_push_delivery_context(delivery,worker);
 if value is null or value->>'kind'<>'SUPPORT' or value::text like '%private message%' or value::text like '%@example.test%' then raise exception 'BUSINESS_PUSH_DELIVERY_OR_PRIVACY_FAILED';end if;
 if read_before is distinct from public.chat_read_state('SUPPORT',chat,staff_id) then raise exception 'PUSH_CREATED_SEEN';end if;
 update public.business_workspace_members set active=false where workspace_id=workspace and user_id=staff_id;
 if public.native_push_binding_active(binding) or public.native_push_delivery_context(delivery,worker) is not null then raise exception 'REVOKED_MEMBER_PUSH_SENT';end if;
 if (select state from public.native_push_outbox where id=delivery)<>'CANCELLED' then raise exception 'REVOKED_PENDING_PUSH_NOT_CANCELLED';end if;
 perform pg_temp.expect_business_push_denied(format('select pg_temp.register_business_push(%L,%L,%L,%L)',staff_id,staff_session,installation,'revoked-member'));
 update public.business_workspace_members set active=true where workspace_id=workspace and user_id=staff_id;

 update public.business_workspaces set active=false where id=workspace;
 if public.native_push_binding_active(binding) then raise exception 'ARCHIVED_BUSINESS_PUSH_ACTIVE';end if;
 perform pg_temp.expect_business_push_denied(format('select pg_temp.register_business_push(%L,%L,%L,%L)',staff_id,staff_session,installation,'archived-business'));
 update public.business_workspaces set active=true where id=workspace;
 update public.profiles set active=false where id=staff_id;
 if public.native_push_binding_active(binding) then raise exception 'INACTIVE_CUSTOMER_PUSH_ACTIVE';end if;
 update public.profiles set active=true where id=staff_id;
 update auth.users set deleted_at=now() where id in(staff_id,provider_id);
 if public.native_push_binding_active(binding) or exists(select 1 from public.native_push_bindings b where b.installation_id=provider_installation and public.native_push_binding_active(b.id)) then raise exception 'ERASED_IDENTITY_PUSH_ACTIVE';end if;
 perform pg_temp.expect_business_push_denied(format('select pg_temp.register_business_push(%L,%L,%L,%L)',staff_id,staff_session,installation,'erased-customer'));
 perform pg_temp.expect_business_push_denied(format('select pg_temp.register_business_push(%L,%L,%L,%L)',provider_id,provider_session,provider_installation,'erased-provider'));
 update auth.users set deleted_at=null,banned_until=now()+interval '1 hour' where id=staff_id;
 if public.native_push_binding_active(binding) then raise exception 'BANNED_CUSTOMER_PUSH_ACTIVE';end if;
 update auth.users set banned_until=null where id=staff_id;
 update auth.users set deleted_at=null where id=provider_id;
 update auth.sessions set not_after=now()-interval '1 second' where id=staff_session;
 if public.native_push_binding_active(binding) then raise exception 'EXPIRED_SESSION_PUSH_ACTIVE';end if;
 perform pg_temp.expect_business_push_denied(format('select pg_temp.register_business_push(%L,%L,%L,%L)',staff_id,staff_session,installation,'expired-session'));
 update auth.sessions set not_after=null where id=staff_session;
 if not public.native_push_binding_active(binding) then raise exception 'RESTORED_VALID_MEMBER_PUSH_REJECTED';end if;

 -- The original per-person device bound remains in force.
 for index_value in 2..10 loop perform pg_temp.register_business_push(staff_id,staff_session,gen_random_uuid(),'device-'||staff_id||'-'||index_value);end loop;
 perform pg_temp.expect_business_push_denied(format('select pg_temp.register_business_push(%L,%L,%L,%L)',staff_id,staff_session,gen_random_uuid(),'eleventh-device'),'PUSH_DEVICE_LIMIT');
 delete from auth.sessions where id=staff_session;
 if public.native_push_binding_active(binding) then raise exception 'LOGGED_OUT_CUSTOMER_PUSH_ACTIVE';end if;
 foreach role_name in array array['anon','authenticated'] loop
  foreach signature in array array['public.native_push_binding_active(uuid)','public.register_native_push_binding(uuid,text,text,text,uuid,uuid,uuid,text)','public.native_push_delivery_context(uuid,uuid)'] loop
   if has_function_privilege(role_name,signature,'execute') then raise exception 'BROWSER_PUSH_RPC_EXPOSED';end if;
  end loop;
 end loop;
 if not has_function_privilege('service_role','public.register_native_push_binding(uuid,text,text,text,uuid,uuid,uuid,text)','execute')
  or public.can_access_transport_chat(gen_random_uuid(),repeat('b',64),null) then raise exception 'PUSH_SERVICE_OR_RETIREMENT_CHANGED';end if;
 raise notice 'PASS: current customer own Support push, provider compatibility, private session/device/lease checks, membership/identity/session revocation and retired guest denial; no physical delivery claimed';
end $test$;
rollback;
