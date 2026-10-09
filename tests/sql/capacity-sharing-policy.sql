-- Synthetic, rollback-only tests against the actual command and projection functions.
begin;
do $test$
declare owner_id uuid; driver_id uuid; other_driver uuid; org_id uuid; truck_id uuid; saved_id uuid;
 route_points jsonb; command jsonb; result jsonb; mode_value text; expected_public boolean; expected_private boolean;
 digest_a text:=repeat('a',64); digest_b text:=repeat('b',64); grant_a uuid; payload jsonb;
begin
 select m.user_id,m.organization_id,d.user_id into strict owner_id,org_id,driver_id
 from organization_members m join drivers d on d.organization_id=m.organization_id and d.active
 join profiles p on p.id=d.user_id and p.active join lateral provider_capacity_actor_scope(m.user_id) a on a.workspace_access
 where m.membership_role='OWNER' limit 1;
 select id into strict other_driver from profiles where role='DRIVER' and active and id<>driver_id limit 1;
 result:=create_provider_vehicle(owner_id,'{"make":"Sharing audit","model":"Test","plate":"AUDIT-SHARING-POLICY","cargo_configuration":"Mini Box Truck"}');truck_id:=(result->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',true,'can_manage_tracking',true));
 perform refresh_provider_capacity_location(driver_id,jsonb_build_object('vehicle_id',truck_id,'approximate_lat',41.8781,'approximate_lng',-87.6298,'location_precision_km',20));
 select current_route_points_json into strict route_points from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 update company_pages set published=true where organization_id=org_id;
 command:=jsonb_build_object('vehicle_id',truck_id,'status','EMPTY','accepted_loads','BOTH','availability_geometry','ROUTE','location_source','PRESERVE_DRIVER','current_route_places',route_points);
 saved_id:=publish_provider_capacity(owner_id,command||'{"sharing_mode":"PUBLIC"}');
 result:=grant_private_capacity_access(owner_id,truck_id,'sharing-a@example.invalid',digest_a);grant_a:=(result->>'id')::uuid;
 perform grant_private_capacity_access(owner_id,truck_id,'sharing-b@example.invalid',digest_b);
 if capacity_sharing_mode(truck_id)<>'BOTH' then raise exception 'LEGACY_CONTACT_NOT_ENABLED';end if;
 foreach mode_value in array array['PUBLIC','PRIVATE','BOTH','EXCLUSIVE'] loop
  saved_id:=publish_provider_capacity(driver_id,command||jsonb_build_object('sharing_mode',mode_value,'exclusive_email','sharing-a@example.invalid','exclusive_digest',digest_a));
  update capacities set updated_at=clock_timestamp() where id=saved_id;
  expected_public:=mode_value in ('PUBLIC','BOTH');expected_private:=mode_value<>'PUBLIC';
  if exists(select 1 from public_capacity_page(jsonb_build_object('vehicle_ids',jsonb_build_array(truck_id)),null,null,14))<>expected_public then raise exception 'PUBLIC_PAGE_MODE_MATRIX: %',mode_value;end if;
  if exists(select 1 from capacity_search_public_rows(jsonb_build_object('capacity_id',saved_id),null,null,14))<>expected_public then raise exception 'PUBLIC_SEARCH_MODE_MATRIX: %',mode_value;end if;
  if exists(select 1 from private_capacity_projection('EMAIL',digest_a) r where r.payload->>'vehicle_id'=truck_id::text)<>expected_private then raise exception 'PRIVATE_PROJECTION_MODE_MATRIX: %',mode_value;end if;
  if exists(select 1 from private_capacity_filtered_page('EMAIL',digest_a,null,null,null,100,'{}') r where r.payload->>'vehicle_id'=truck_id::text)<>expected_private then raise exception 'PRIVATE_FILTER_MODE_MATRIX: %',mode_value;end if;
  if exists(select 1 from capacity_search_private_rows('EMAIL',digest_a,null,null,null,100,'{}') r where r.payload->>'vehicle_id'=truck_id::text)<>expected_private then raise exception 'PRIVATE_SEARCH_MODE_MATRIX: %',mode_value;end if;
  if exists(select 1 from private_capacity_projection('EMAIL',digest_b) r where r.payload->>'vehicle_id'=truck_id::text)<>(mode_value in ('PRIVATE','BOTH')) then raise exception 'OTHER_RECIPIENT_MODE_MATRIX: %',mode_value;end if;
  select r.payload into payload from private_capacity_projection('EMAIL',digest_a) r where r.payload->>'vehicle_id'=truck_id::text;
  if expected_private and (payload->>'sharing_mode'<>mode_value or payload ? 'exclusive_email' or payload ? 'exclusive_digest' or payload ? 'grants') then raise exception 'MODE_OR_CONTACT_PROJECTION_LEAK';end if;
 end loop;
 begin perform grant_private_capacity_access(owner_id,truck_id,'sharing-b@example.invalid',digest_b);raise exception 'EXCLUSIVE_EXTRA_EMAIL_ALLOWED';exception when raise_exception then if sqlerrm<>'EXCLUSIVE_RECIPIENT_ONLY' then raise;end if;end;
 begin perform set_loadgistic_capacity_access(owner_id,truck_id,true,repeat('c',64));raise exception 'EXCLUSIVE_PLATFORM_ALLOWED';exception when raise_exception then if sqlerrm<>'EXCLUSIVE_RECIPIENT_ONLY' then raise;end if;end;
 begin perform set_provider_capacity_sharing(other_driver,truck_id,'PUBLIC');raise exception 'FOREIGN_POLICY_MUTATION';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 begin perform set_provider_capacity_sharing(owner_id,truck_id,'EXCLUSIVE',null,null);raise exception 'MISSING_EXCLUSIVE_RECIPIENT';exception when raise_exception then if sqlerrm<>'EXCLUSIVE_EMAIL_REQUIRED' then raise;end if;end;
 -- Both OTP stages recheck sharing policy, including stale challenges after a change.
 if request_shared_capacity_otp(gen_random_uuid(),'sharing-b@example.invalid',digest_b,'sharing-policy-deny',clock_timestamp()+interval '5 minutes') then raise exception 'EXCLUSIVE_WRONG_RECIPIENT_OTP';end if;
 if not request_shared_capacity_otp(gen_random_uuid(),'sharing-a@example.invalid',digest_a,'sharing-policy-allow',clock_timestamp()+interval '5 minutes') then raise exception 'EXCLUSIVE_RECIPIENT_OTP_MISSING';end if;
 perform set_provider_capacity_sharing(owner_id,truck_id,'PUBLIC');
 if consume_shared_capacity_otp(digest_a,'sharing-policy-allow') then raise exception 'STALE_MODE_OTP_AUTHORIZED';end if;
 perform set_provider_capacity_sharing(owner_id,truck_id,'EXCLUSIVE','sharing-a@example.invalid',digest_a);
 perform revoke_private_capacity_access(owner_id,grant_a);
 -- Old clients cannot override Exclusive, and new unrelated saves cannot regrant it.
 saved_id:=publish_provider_capacity(driver_id,command||'{"visibility":"OPEN"}');
 saved_id:=publish_provider_capacity(driver_id,command||jsonb_build_object('sharing_mode','EXCLUSIVE','exclusive_email','sharing-a@example.invalid','exclusive_digest',digest_a));
 if capacity_sharing_mode(truck_id)<>'EXCLUSIVE' or exists(select 1 from capacity_access_grants where id=grant_a and revoked_at is null)
  or exists(select 1 from private_capacity_projection('EMAIL',digest_a) r where r.payload->>'vehicle_id'=truck_id::text) then raise exception 'UNRELATED_SAVE_RESURRECTED_ACCESS';end if;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',false,'can_manage_tracking',true));
 begin perform set_provider_capacity_sharing(driver_id,truck_id,'PUBLIC');raise exception 'UNPERMITTED_DRIVER_POLICY';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 if has_table_privilege('anon','vehicle_capacity_sharing','SELECT') or has_table_privilege('authenticated','vehicle_capacity_sharing','SELECT')
  or has_function_privilege('anon','set_provider_capacity_sharing(uuid,uuid,text,text,text)','EXECUTE')
  or has_function_privilege('authenticated','capacity_sharing_allows(uuid,text,text)','EXECUTE')
  or not(select relrowsecurity from pg_class where oid='vehicle_capacity_sharing'::regclass) then raise exception 'SHARING_BROWSER_ACCESS';end if;
 raise notice 'PASS: four modes, every projection, OTP recheck, exclusive denials, old clients, revoked invitations, permissions and RLS';
end $test$;
rollback;
