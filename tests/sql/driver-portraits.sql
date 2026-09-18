-- Isolated local fixtures. No Storage writes; all database changes roll back.
begin;
create function pg_temp.expect_portrait_denied(command text,expected text) returns void language plpgsql as $$
begin
  begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;
  raise exception 'EXPECTED_PORTRAIT_DENIAL';
end $$;
do $test$
declare actor uuid;other_driver uuid;owner_id uuid;admin_id uuid;first_id uuid;second_id uuid;pending_id uuid;stale_id uuid;cancelled_id uuid;
  result jsonb;original jsonb;n integer;reference text;signature text;role_name text;
begin
  select id into strict actor from profiles where email='driver@loadgistic.local';
  select id into strict other_driver from profiles where role='DRIVER' and active and id<>actor limit 1;
  select id into strict owner_id from profiles where email='transporter@loadgistic.local';
  select id into strict admin_id from profiles where email='admin@loadgistic.local';
  update profiles set driver_portrait_preset='abebe-owner-operator.jpg' where id=actor;
  select to_jsonb(p)-'driver_portrait_preset' into original from profiles p where id=actor;
  if driver_portrait_workspace(actor)->>'preset'<>'abebe-owner-operator.jpg' then raise exception 'PRESET_MISSING';end if;
  reference:='supabase://provider-profile/driver-portrait/2026-09-14/'||gen_random_uuid()||'.jpg';
  first_id:=reserve_driver_portrait(actor,reference,1000);
  if public_driver_portrait_file(first_id) is not null then raise exception 'PENDING_PUBLIC';end if;
  perform pg_temp.expect_portrait_denied(format('select activate_driver_portrait(%L,%L,false)',actor,first_id),'PORTRAIT_CONSENT_REQUIRED');
  perform pg_temp.expect_portrait_denied(format('select activate_driver_portrait(%L,%L,null)',actor,first_id),'PORTRAIT_CONSENT_REQUIRED');
  perform pg_temp.expect_portrait_denied(format('select activate_driver_portrait(%L,%L,true)',other_driver,first_id),'NOT_FOUND');
  perform activate_driver_portrait(actor,first_id,true);
  if public_driver_portrait_file(first_id)->>'file_path'<>reference then raise exception 'ACTIVE_UNREADABLE';end if;
  if discard_pending_driver_portrait(actor,first_id) then raise exception 'AMBIGUOUS_RESPONSE_DELETED_ACTIVE';end if;
  perform activate_driver_portrait(actor,first_id,true); -- retry does not duplicate audit/state
  if (select count(*) from audit_logs where actor_user_id=actor and action='DRIVER_PORTRAIT_UPDATED')<>1 then raise exception 'NON_IDEMPOTENT_RETRY';end if;
  result:=driver_portrait_workspace(actor);
  if result->>'public_id'<>first_id::text or result->>'preset' is not null or result::text like '%supabase://%' then raise exception 'UNSAFE_WORKSPACE';end if;
  if (select to_jsonb(p)-'driver_portrait_preset' from profiles p where id=actor)<>original then raise exception 'ACCOUNT_FIELDS_CHANGED';end if;

  second_id:=reserve_driver_portrait(actor,'supabase://provider-profile/driver-portrait/2026-09-14/'||gen_random_uuid()||'.jpg',1000);
  perform activate_driver_portrait(actor,second_id,true);
  if public_driver_portrait_file(first_id) is not null or public_driver_portrait_file(second_id) is null then raise exception 'REPLACE_FAILED';end if;
  update profiles set active=false where id=actor;
  if public_driver_portrait_file(second_id) is not null then raise exception 'INACTIVE_PUBLIC';end if;
  perform pg_temp.expect_portrait_denied(format('select remove_driver_portrait(%L)',actor),'FORBIDDEN');
  perform pg_temp.expect_portrait_denied(format('select driver_portrait_workspace(%L)',actor),'FORBIDDEN');
  perform pg_temp.expect_portrait_denied(format('select reserve_driver_portrait(%L,%L,100)',actor,reference),'FORBIDDEN');
  update profiles set active=true where id=actor;
  perform remove_driver_portrait(actor);
  if public_driver_portrait_file(second_id) is not null then raise exception 'REMOVE_FAILED';end if;
  pending_id:=reserve_driver_portrait(actor,'supabase://provider-profile/driver-portrait/2026-09-14/'||gen_random_uuid()||'.jpg',1000);
  stale_id:=reserve_driver_portrait(actor,'supabase://provider-profile/driver-portrait/2026-09-14/'||gen_random_uuid()||'.jpg',1000);
  update driver_portrait_uploads set updated_at=now()-interval '2 hours' where id=stale_id;
  select count(*) into n from claim_driver_portrait_cleanup(1);
  if n<>1 then raise exception 'CLEANUP_NOT_BOUNDED';end if;
  perform 1 from claim_driver_portrait_cleanup(500);
  if exists(select 1 from driver_portrait_uploads where id in(first_id,second_id,stale_id) and state<>'DELETING') then raise exception 'CLEANUP_NOT_CLAIMED';end if;
  if (select state from driver_portrait_uploads where id=pending_id)<>'PENDING' then raise exception 'FRESH_UPLOAD_CLAIMED';end if;
  perform pg_temp.expect_portrait_denied(format('select activate_driver_portrait(%L,%L,true)',actor,stale_id),'NOT_FOUND');
  if exists(select 1 from claim_driver_portrait_cleanup(20)) then raise exception 'EARLY_RETRY';end if;
  update driver_portrait_uploads set updated_at=now()-interval '6 minutes' where id=first_id;
  if not exists(select 1 from claim_driver_portrait_cleanup(20) where id=first_id) then raise exception 'RETRY_NOT_CLAIMED';end if;
  if discard_pending_driver_portrait(other_driver,pending_id) then raise exception 'CROSS_ACCOUNT_DISCARD';end if;
  perform discard_pending_driver_portrait(actor,pending_id);
  cancelled_id:=reserve_driver_portrait(actor,'supabase://provider-profile/driver-portrait/2026-09-14/'||gen_random_uuid()||'.jpg',1000);
  perform remove_driver_portrait(actor);
  if exists(select 1 from claim_driver_portrait_cleanup(20) where id=cancelled_id) then raise exception 'IN_FLIGHT_UPLOAD_DELETED';end if;
  perform pg_temp.expect_portrait_denied(format('select activate_driver_portrait(%L,%L,true)',actor,cancelled_id),'NOT_FOUND');
  -- Once the in-flight Storage attempt settles, deletion can safely proceed.
  perform discard_pending_driver_portrait(actor,cancelled_id);
  if not exists(select 1 from claim_driver_portrait_cleanup(20) where id=cancelled_id) then raise exception 'CANCELLED_UPLOAD_NOT_CLEANED';end if;
  foreach actor in array array[owner_id,admin_id,null::uuid] loop
    perform pg_temp.expect_portrait_denied(format('select driver_portrait_workspace(%L)',actor),'FORBIDDEN');
    perform pg_temp.expect_portrait_denied(format('select reserve_driver_portrait(%L,%L,100)',actor,reference),'FORBIDDEN');
    perform pg_temp.expect_portrait_denied(format('select remove_driver_portrait(%L)',actor),'FORBIDDEN');
  end loop;
  foreach role_name in array array['anon','authenticated'] loop
    if has_table_privilege(role_name,'driver_portrait_uploads','SELECT,INSERT,UPDATE,DELETE') then raise exception 'BROWSER_TABLE_ACCESS';end if;
    foreach signature in array array['driver_portrait_workspace(uuid)','reserve_driver_portrait(uuid,text,integer)',
      'activate_driver_portrait(uuid,uuid,boolean)','remove_driver_portrait(uuid)','discard_pending_driver_portrait(uuid,uuid)',
      'public_driver_portrait_file(uuid)','claim_driver_portrait_cleanup(integer)'] loop
      if has_function_privilege(role_name,signature,'EXECUTE') then raise exception 'BROWSER_RPC_ACCESS';end if;
    end loop;
  end loop;
end $test$;
rollback;
