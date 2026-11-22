begin;
set local search_path=public,extensions,pg_temp;
do $test$
declare provider uuid:=gen_random_uuid(); partner uuid:=gen_random_uuid(); other_account uuid:=gen_random_uuid();
 shipment uuid:=gen_random_uuid(); provider_profile uuid:=gen_random_uuid(); uid uuid; truck uuid; cities text[]; sid uuid; cmd jsonb;
 partner_address text:='partner-'||partner||'@example.invalid'; authority jsonb; link jsonb; guest jsonb;
begin
 foreach uid in array array[provider,partner,other_account] loop
  insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_user_meta_data)
  values(uid,'partner-'||uid||'@example.invalid',clock_timestamp(),clock_timestamp(),'{}');
 end loop;
 update profiles set role='DRIVER',active=true,drives_truck=true where id=provider;
 update profiles set role='SHIPPER',active=true where id in(partner,other_account);
 insert into provider_profiles(id,user_id,business_name,handle) values(provider_profile,provider,'Single partner fixture','partner-'||provider);
 perform accept_content_policy(provider,'2026-10-09');perform accept_content_policy(partner,'2026-10-09');
 truck:=(create_provider_vehicle(provider,'{"make":"Synthetic","model":"Partner","plate":"SQL-230","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(provider,jsonb_build_object('driver_user_id',provider,'vehicle_id',truck,'can_manage_tracking',true,'can_manage_capacity',true));
 select array_agg(id order by id) into cities from(select id from place_catalog where latitude is not null and longitude is not null order by id limit 3)c;
 cmd:=jsonb_build_object('id',shipment,'code','LGX-'||upper(left(shipment::text,8)),'vehicle_id',truck,'origin_place_ref',cities[1],
 'passing_place_ref',cities[2],'destination_place_ref',cities[3],'cargo_summary','Partner order test','expected_delivery_date',current_date+2,'tracking_mode','STATUS_ONLY');
 perform start_tracking_without_partner(provider,cmd);
 select id into strict sid from tracking_sessions where shipment_id=shipment and awaiting_partner and owner_user_id is null;
 if (provider_tracking_detail(provider,shipment::text)->>'can_add_partner')::boolean is distinct from true
 or exists(select 1 from provider_tracking_recipients where shipment_id=shipment) then raise exception 'UNPARTNERED_START';end if;
 begin perform attach_tracking_partner(other_account,shipment,partner_address,repeat('a',64));raise exception 'FOREIGN_ATTACH_ALLOWED';
 exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 begin perform attach_tracking_partner(provider,shipment,'unknown@example.invalid',repeat('a',64));raise exception 'UNKNOWN_ATTACH_ALLOWED';
 exception when raise_exception then if sqlerrm<>'TRACKING_REGISTERED_OWNER_REQUIRED' then raise;end if;end;
 perform attach_tracking_partner(provider,shipment,partner_address,repeat('a',64));
 if (select owner_user_id from tracking_sessions where id=sid) is distinct from partner or
 (select count(*) from provider_tracking_recipients where shipment_id=shipment and recipient_role='OWNER')<>1 or
 (provider_tracking_detail(provider,shipment::text)->>'can_add_partner')::boolean is distinct from false or
 (tracking_session_workspace(partner,null)->>'total')::int<>1 then raise exception 'PARTNER_BINDING';end if;
 begin perform attach_tracking_partner(provider,shipment,'partner-'||other_account||'@example.invalid',repeat('b',64));raise exception 'SECOND_PARTNER_ALLOWED';
 exception when raise_exception then if sqlerrm<>'TRACKING_SESSION_CHANGED' then raise;end if;end;
 authority:=tracking_session_detail(partner,sid)->'capabilities';
 if authority->'canIssueLink' is distinct from 'true'::jsonb then raise exception 'PARTNER_LINK_AUTHORITY';end if;
 link:=issue_tracking_session_link(partner,sid,repeat('b',64),repeat('c',64),'{"allowLocation":false}');
 guest:=read_tracking_session_link(repeat('b',64),repeat('c',64));
 if guest->>'sessionId' is distinct from sid::text or guest?'capabilities' or guest?'owner_user_id' or guest::text like '%'||partner_address||'%' then raise exception 'GUEST_SCOPE';end if;
 if has_function_privilege('authenticated','attach_tracking_partner(uuid,uuid,text,text)','EXECUTE') or
 has_function_privilege('anon','start_tracking_without_partner(uuid,jsonb)','EXECUTE') then raise exception 'PARTNER_RPC_GRANT';end if;
end $test$;
rollback;
