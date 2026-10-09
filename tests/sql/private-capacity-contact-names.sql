-- Run in a rolled-back local transaction. Synthetic contacts only.
begin;
do $test$
declare owner_id uuid; driver_id uuid; other_id uuid; truck_id uuid; grant_id uuid;
 result jsonb; original_creator uuid; original_time timestamptz; route_points jsonb;
begin
 select m.user_id,d.user_id into strict owner_id,driver_id
 from organization_members m join drivers d on d.organization_id=m.organization_id and d.active
 join profiles p on p.id=d.user_id and p.active
 where m.membership_role='OWNER' limit 1;
 select id into strict other_id from profiles where role='DRIVER' and active and id<>driver_id limit 1;
 result:=create_provider_vehicle(owner_id,'{"make":"Contact audit","model":"Test","plate":"AUDIT-CONTACT-NAME","cargo_configuration":"Mini Box Truck"}');truck_id:=(result->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',true));
 result:=grant_named_private_capacity_access(driver_id,truck_id,'contact-audit@example.invalid',repeat('d',64),'አበበ ትራንስፖርት');grant_id:=(result->>'id')::uuid;
 select created_by,created_at into original_creator,original_time from capacity_access_grants where id=grant_id;
 result:=grant_named_private_capacity_access(driver_id,truck_id,'CONTACT-AUDIT@example.invalid',repeat('d',64),'Broker company');
 if (result->>'id')::uuid<>grant_id or (result->>'created')::boolean then raise exception 'DUPLICATED_CONTACT'; end if;
 if not exists(select 1 from capacity_access_grants where id=grant_id and created_by=original_creator and created_at=original_time and recipient_name='Broker company') then raise exception 'CONTACT_HISTORY_CHANGED';end if;
 perform name_private_capacity_contact(owner_id,grant_id,'Customer company');
 if not exists(select 1 from private_capacity_network(owner_id) n,jsonb_array_elements(n.payload->'grants') g where g->>'id'=grant_id::text and g->>'recipient_name'='Customer company') then raise exception 'NAME_NOT_IN_MANAGEMENT';end if;
 if exists(select 1 from private_capacity_network(other_id) n,jsonb_array_elements(n.payload->'grants') g where g->>'id'=grant_id::text) then raise exception 'FOREIGN_NAME_READ';end if;
 begin perform name_private_capacity_contact(other_id,grant_id,'Forged name');raise exception 'FOREIGN_NAME_WRITE';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 update profiles set active=false where id=driver_id;
 begin perform name_private_capacity_contact(driver_id,grant_id,'Inactive');raise exception 'INACTIVE_NAME_WRITE';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 if exists(select 1 from private_capacity_network(driver_id)) then raise exception 'INACTIVE_NAME_READ';end if;
 update profiles set active=true where id=driver_id;
 begin perform grant_named_private_capacity_access(driver_id,truck_id,'invalid-contact@example.invalid',repeat('e',64),' ');raise exception 'BLANK_CONTACT_ACCEPTED';exception when raise_exception then if sqlerrm<>'CONTACT_NAME_REQUIRED' then raise;end if;end;
 begin perform name_private_capacity_contact(driver_id,grant_id,E'bad\nname');raise exception 'CONTROL_CONTACT_ACCEPTED';exception when raise_exception then if sqlerrm<>'CONTACT_NAME_REQUIRED' then raise;end if;end;
 begin perform name_private_capacity_contact(driver_id,grant_id,repeat('a',101));raise exception 'OVERSIZED_CONTACT_ACCEPTED';exception when raise_exception then if sqlerrm<>'CONTACT_NAME_REQUIRED' then raise;end if;end;
 -- Legacy saves do not erase a current label; existing unnamed records stay valid.
 perform grant_private_capacity_access(driver_id,truck_id,'contact-audit@example.invalid',repeat('d',64));
 if (select recipient_name from capacity_access_grants where id=grant_id)<>'Customer company' then raise exception 'LEGACY_NAME_ERASED';end if;
 result:=grant_private_capacity_access(driver_id,truck_id,'legacy-contact@example.invalid',repeat('f',64));
 if (select recipient_name from capacity_access_grants where id=(result->>'id')::uuid) is not null then raise exception 'LEGACY_NAME_INVENTED';end if;
 perform revoke_private_capacity_access(owner_id,(result->>'id')::uuid);
 begin perform name_private_capacity_contact(driver_id,(result->>'id')::uuid,'Revoked');raise exception 'REVOKED_CONTACT_REVIVED';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 -- New Exclusive publication is atomic with its label, preserving location.
 perform refresh_provider_capacity_location(driver_id,jsonb_build_object('vehicle_id',truck_id,'approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20,'location_source','DEVICE_OBSCURED'));
 select current_route_points_json into strict route_points from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 result:=jsonb_build_object('vehicle_id',truck_id,'status','EMPTY','accepted_loads','BOTH','availability_geometry','ROUTE','visibility','PRIVATE','location_source','PRESERVE_DRIVER','sharing_mode','EXCLUSIVE',
 'exclusive_email','contact-audit@example.invalid','exclusive_digest',repeat('d',64),'exclusive_name','Main customer',
 'current_route_places',jsonb_build_array(jsonb_build_object('place_ref',route_points->0->>'place_ref'),jsonb_build_object('place_ref',route_points->1->>'place_ref')));
 perform publish_provider_capacity(driver_id,result);
 if not exists(select 1 from jsonb_array_elements(provider_capacity_workspace(driver_id)->'capacities') c where c->>'exclusive_name'='Main customer') then raise exception 'EXCLUSIVE_NAME_NOT_RETURNED';end if;
 begin perform publish_provider_capacity(driver_id,result||'{"exclusive_name":"","exclusive_email":"bad-exclusive@example.invalid","exclusive_digest":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"}');raise exception 'UNNAMED_EXCLUSIVE_ACCEPTED';exception when raise_exception then if sqlerrm<>'CONTACT_NAME_REQUIRED' then raise;end if;end;
 if (select exclusive_email from vehicle_capacity_sharing where vehicle_id=truck_id)<>'contact-audit@example.invalid' then raise exception 'INVALID_EXCLUSIVE_PARTIALLY_SAVED';end if;
 if exists(select 1 from audit_logs where entity_id=grant_id and details::text like '%Customer company%') then raise exception 'CONTACT_NAME_IN_AUDIT';end if;
 if exists(select 1 from private_capacity_projection('EMAIL',repeat('d',64),null,null,null,100) row where row.payload::text like '%recipient_name%' or row.payload::text like '%Main customer%') then raise exception 'VISITOR_CONTACT_NAME_LEAK';end if;
 if has_function_privilege('anon','name_private_capacity_contact(uuid,uuid,text)','execute') or has_function_privilege('authenticated','grant_named_private_capacity_access(uuid,uuid,text,text,text)','execute') then raise exception 'BROWSER_CONTACT_COMMAND';end if;
 if not (select relrowsecurity from pg_class where oid='public.capacity_access_grants'::regclass) then raise exception 'CONTACT_RLS_DISABLED';end if;
 raise notice 'PASS: named contact, grant identity/history, owner oversight, foreign/revoked denial, legacy labels, Exclusive atomicity and visitor privacy.';
end $test$;
rollback;
