-- FEAT-TRK-001: proof-backed unloading requires shipment-owner approval.
-- No historical proof, ETA or approval is invented.
alter table public.provider_shipments add column handover_approved_at timestamptz,
 add column handover_approval_kind text check(handover_approval_kind in ('OWNER','STAFF'));
-- A verified email guest has no member profile. Record the recipient identity,
-- never attribute their approval to a driver or a fabricated member account.
alter table public.provider_shipment_events alter column created_by drop not null,
 add column approved_by_recipient_id uuid references public.provider_tracking_recipients(id),
 add constraint tracking_event_actor_required check(created_by is not null or (status='COMPLETED' and approved_by_recipient_id is not null));
create table public.provider_tracking_appeals(
 id uuid primary key default gen_random_uuid(),shipment_id uuid not null references public.provider_shipments(id),
 driver_user_id uuid not null references public.profiles(id),reason text not null check(length(reason) between 5 and 1000),
 status text not null default 'OPEN' check(status in ('OPEN','APPROVED','RELEASED','DISMISSED')),
 created_at timestamptz not null default clock_timestamp(),resolved_at timestamptz,
 resolved_by uuid references public.profiles(id),resolution_note text check(resolution_note is null or length(resolution_note) between 5 and 1000)
);
create unique index provider_tracking_one_open_appeal on public.provider_tracking_appeals(shipment_id) where status='OPEN';
alter table public.provider_tracking_appeals enable row level security;
revoke all on public.provider_tracking_appeals from public,anon,authenticated;
grant select,insert,update,delete on public.provider_tracking_appeals to service_role;
create function public.keep_provider_tracking_mode() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin if new.tracking_mode is distinct from old.tracking_mode then raise exception 'TRACKING_MODE_LOCKED';end if;return new;end;
$$;
revoke all on function public.keep_provider_tracking_mode() from public,anon,authenticated;
create trigger provider_tracking_mode_immutable before update of tracking_mode on public.provider_shipments
 for each row execute function public.keep_provider_tracking_mode();
-- NOT VALID retains old >20 km event history; every new event must meet the new limit.
alter table public.provider_shipment_events add constraint tracking_location_twenty_km
 check(location_source is distinct from 'DEVICE_OBSCURED' or location_precision_km in (1,3,5,10,20)) not valid;

create function public.complete_provider_handover(target_shipment_id uuid,actor_user_id uuid,approval_kind text,recipient_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare shipment public.provider_shipments%rowtype; stamp timestamptz:=clock_timestamp();expiry timestamptz;
begin
 select * into shipment from public.provider_shipments where id=target_shipment_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if shipment.operational_status='COMPLETED' and shipment.handover_approved_at is not null then return jsonb_build_object('approved',true,'alreadyApproved',true);end if;
 if shipment.operational_status<>'UNLOADING' then raise exception 'TRACKING_NOT_READY_FOR_APPROVAL';end if;
 if not exists(select 1 from public.provider_shipment_events where shipment_id=shipment.id and status='LOADING' and proof_storage_path is not null)
  or not exists(select 1 from public.provider_shipment_events where shipment_id=shipment.id and status='UNLOADING' and proof_storage_path is not null) then raise exception 'TRACKING_HANDOVER_PROOF_REQUIRED';end if;
 expiry:=stamp+interval '30 days';
 update public.provider_shipments set operational_status='COMPLETED',completed_at=stamp,updated_at=stamp,
  guest_expires_at=expiry,handover_approved_at=stamp,handover_approval_kind=approval_kind where id=shipment.id;
 update public.shipment_party_grants set expires_at=expiry where shipment_id=shipment.id and revoked_at is null;
 insert into public.provider_shipment_events(shipment_id,status,event_type,note,created_by,created_at,approved_by_recipient_id)
 values(shipment.id,'COMPLETED','STATUS',case when approval_kind='OWNER' then 'Unloading approved by the shipment owner' else 'Handover approved after staff investigation' end,actor_user_id,stamp,recipient_id);
 insert into public.email_deliveries(id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status,attempts,next_attempt_at,created_at,updated_at)
 values(gen_random_uuid(),shipment.id,'SHIPPER','COMPLETION',shipment.shipper_email,'completion:'||shipment.id::text||':OWNER','PENDING',0,stamp,stamp,stamp)
 on conflict(idempotency_key) do nothing;
 update public.provider_tracking_appeals set status='APPROVED',resolved_at=stamp,resolved_by=actor_user_id,
 resolution_note=case when approval_kind='OWNER' then 'Shipment owner approved unloading' else resolution_note end
 where shipment_id=shipment.id and status='OPEN';
 insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
 values(actor_user_id,shipment.provider_organization_id,'TRACKING_HANDOVER_APPROVED','provider_shipment',shipment.id,jsonb_build_object('approvalKind',approval_kind,'recipientId',recipient_id),stamp);
 return jsonb_build_object('approved',true,'alreadyApproved',false);
end;
$$;
create function public.approve_provider_handover(target_shipment_id uuid,requested_recipient_digest text,verified_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_recipient uuid;
begin
 if verified_at is null or verified_at>clock_timestamp() or verified_at<=clock_timestamp()-interval '5 minutes' then raise exception 'TRACKING_SESSION_EXPIRED';end if;
 perform 1 from public.provider_shipments where id=target_shipment_id for update;
 if not exists(select 1 from public.provider_tracking_recipients r join public.shipment_party_grants g on g.shipment_id=r.shipment_id and g.party_role='SHIPPER'
 join public.provider_shipments s on s.id=r.shipment_id where r.shipment_id=target_shipment_id and r.recipient_email_digest=requested_recipient_digest
 and r.recipient_role='OWNER' and r.revoked_at is null and g.revoked_at is null and (g.expires_at is null or g.expires_at>clock_timestamp())
 and (s.guest_expires_at is null or s.guest_expires_at>clock_timestamp())) then raise exception 'TRACKING_APPROVAL_FORBIDDEN';end if;
 select r.id into owner_recipient from public.provider_tracking_recipients r where r.shipment_id=target_shipment_id and r.recipient_email_digest=requested_recipient_digest and r.recipient_role='OWNER' and r.revoked_at is null;
 return public.complete_provider_handover(target_shipment_id,null,'OWNER',owner_recipient);
end;
$$;
create function public.submit_provider_tracking_appeal(actor_user_id uuid,target_shipment_id uuid,explanation text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare shipment public.provider_shipments%rowtype;created uuid;
begin
 select * into shipment from public.provider_shipments where id=target_shipment_id for update;
 if not found or not public.provider_tracking_actor_owns_shipment(actor_user_id,target_shipment_id)
 or shipment.assigned_driver_user_id is distinct from actor_user_id then raise exception 'NOT_FOUND';end if;
 if shipment.operational_status<>'UNLOADING' then raise exception 'TRACKING_APPEAL_NOT_READY';end if;
 if length(trim(coalesce(explanation,''))) not between 5 and 1000 then raise exception 'TRACKING_APPEAL_REASON_REQUIRED';end if;
 select id into created from public.provider_tracking_appeals where shipment_id=shipment.id and status='OPEN';
 if found then return created;end if;
 insert into public.provider_tracking_appeals(shipment_id,driver_user_id,reason) values(shipment.id,actor_user_id,trim(explanation)) returning id into created;
 insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
 values(actor_user_id,shipment.provider_organization_id,'TRACKING_APPEAL_OPENED','provider_shipment',shipment.id,jsonb_build_object('appealId',created));
 return created;
end;
$$;
create function public.resolve_provider_tracking_appeal(actor_user_id uuid,target_appeal_id uuid,decision text,investigation_note text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare appeal public.provider_tracking_appeals%rowtype; shipment_id uuid;result jsonb;stamp timestamptz:=clock_timestamp();
begin
 if not public.managed_actor_has_permission(actor_user_id,'OPERATIONS') then raise exception 'FORBIDDEN';end if;
 if decision is null or decision not in ('APPROVED','RELEASED','DISMISSED') or length(trim(coalesce(investigation_note,''))) not between 5 and 1000 then raise exception 'TRACKING_INVESTIGATION_REQUIRED';end if;
 select a.shipment_id into shipment_id from public.provider_tracking_appeals a where a.id=target_appeal_id;
 if not found then raise exception 'NOT_FOUND';end if;
 perform 1 from public.provider_shipments where id=shipment_id for update;
 select * into appeal from public.provider_tracking_appeals where id=target_appeal_id for update;
 if appeal.status<>'OPEN' then raise exception 'TRACKING_APPEAL_CLOSED';end if;
 update public.provider_tracking_appeals set status=decision,resolved_at=stamp,resolved_by=actor_user_id,resolution_note=trim(investigation_note) where id=appeal.id;
 if decision='APPROVED' then result:=public.complete_provider_handover(appeal.shipment_id,actor_user_id,'STAFF');
 elsif decision='RELEASED' then
  if (select operational_status from public.provider_shipments where id=appeal.shipment_id)<>'UNLOADING' then raise exception 'TRACKING_APPEAL_NOT_READY';end if;
  update public.provider_shipments set operational_status='CANCELLED',guest_expires_at=stamp,updated_at=stamp where id=appeal.shipment_id;
  update public.shipment_party_grants set revoked_at=stamp,expires_at=stamp where shipment_party_grants.shipment_id=appeal.shipment_id and revoked_at is null;
  update public.provider_tracking_recipients set revoked_at=stamp,revoked_by=actor_user_id where provider_tracking_recipients.shipment_id=appeal.shipment_id and revoked_at is null;
  insert into public.provider_shipment_events(shipment_id,status,event_type,note,created_by,created_at)
  values(appeal.shipment_id,'CANCELLED','STATUS','Driver released after staff investigation',actor_user_id,stamp);
 end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details,created_at)
 values(actor_user_id,'TRACKING_APPEAL_RESOLVED','provider_shipment',appeal.shipment_id,jsonb_build_object('appealId',appeal.id,'decision',decision),stamp);
 return coalesce(result,jsonb_build_object('resolved',true));
end;
$$;
create function public.provider_tracking_appeals(actor_user_id uuid,target_shipment_id uuid default null) returns table(payload jsonb)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if target_shipment_id is null and not public.managed_actor_has_permission(actor_user_id,'OPERATIONS') then raise exception 'FORBIDDEN';end if;
 if target_shipment_id is not null and not (public.managed_actor_has_permission(actor_user_id,'OPERATIONS') or public.provider_tracking_actor_owns_shipment(actor_user_id,target_shipment_id)) then raise exception 'NOT_FOUND';end if;
 return query select jsonb_build_object('id',a.id,'shipment_id',a.shipment_id,'code',s.code,'reason',a.reason,'status',a.status,'created_at',a.created_at,'resolution_note',a.resolution_note)
 from public.provider_tracking_appeals a join public.provider_shipments s on s.id=a.shipment_id
 where (target_shipment_id is null and a.status='OPEN' or a.shipment_id=target_shipment_id)
 order by a.created_at desc,a.id desc limit 100;
end;
$$;
revoke all on function public.provider_tracking_appeals(uuid,uuid) from public,anon,authenticated;
grant execute on function public.provider_tracking_appeals(uuid,uuid) to service_role;
revoke all on function public.complete_provider_handover(uuid,uuid,text,uuid),public.approve_provider_handover(uuid,text,timestamptz),
 public.submit_provider_tracking_appeal(uuid,uuid,text),public.resolve_provider_tracking_appeal(uuid,uuid,text,text) from public,anon,authenticated;
-- Internal completion is intentionally not a browser OR service-role RPC: only guarded definer commands call it.
revoke all on function public.complete_provider_handover(uuid,uuid,text,uuid) from service_role;
grant execute on function public.approve_provider_handover(uuid,text,timestamptz),public.submit_provider_tracking_appeal(uuid,uuid,text),
 public.resolve_provider_tracking_appeal(uuid,uuid,text,text) to service_role;

do $migration$
declare signature text;definition text;before_text text;after_text text;
begin
 signature:='provider_tracking_actor_owns_shipment(uuid,uuid)';
 before_text:=$before$where actor.workspace_access and actor.can_manage_tracking$before$;after_text:=$after$where actor.can_manage_tracking and (actor.workspace_access or shipment.operational_status not in ('COMPLETED','CANCELLED'))$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='create_provider_tracking(uuid,jsonb)';
 before_text:=$before$  if pickup_date is not null and delivery_date is not null$before$;after_text:=$after$  if delivery_date is null then raise exception 'TRACKING_DELIVERY_DATE_REQUIRED';end if;
  if pickup_date is not null and delivery_date is not null$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='recover_provider_tracking(uuid,uuid,jsonb)';
 before_text:=$before$  if pickup is not null and delivery is not null$before$;after_text:=$after$  if shipment.expected_delivery_date is not null and delivery is null then raise exception 'TRACKING_DELIVERY_DATE_REQUIRED';end if;
  if shipment.operational_status not in ('CREATED','TO_PICKUP') and delivery is distinct from shipment.expected_delivery_date and not public.managed_actor_has_permission(actor_user_id,'OPERATIONS') then raise exception 'TRACKING_DELIVERY_DATE_LOCKED';end if;
  if pickup is not null and delivery is not null$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='update_provider_tracking_status(uuid,uuid,jsonb)';
 before_text:=$before$      or proof->>'mime_type' not in$before$;after_text:=$after$      or proof->>'mime_type' is null or proof->>'mime_type' not in$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='update_provider_tracking_status(uuid,uuid,jsonb)';
 before_text:=$before$  if next_status='ISSUE' and clean_note=''$before$;after_text:=$after$  if next_status='COMPLETED' then raise exception 'TRACKING_OWNER_APPROVAL_REQUIRED';end if;
  if next_status in ('IN_TRANSIT','UNLOADING') and not exists(select 1 from public.provider_shipment_events where shipment_id=shipment.id and status='LOADING' and proof_storage_path is not null) then raise exception 'TRACKING_LOADING_PROOF_REQUIRED';end if;
  if next_status='ISSUE' and clean_note=''$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='update_provider_tracking_status(uuid,uuid,jsonb)';
 before_text:=$before$  if shipment.tracking_mode='LOCATION_AND_STATUS' and next_status$before$;after_text:=$after$  if next_status in ('LOADING','UNLOADING') and proof is null then raise exception 'TRACKING_HANDOVER_PROOF_REQUIRED';end if;

  if shipment.tracking_mode='LOCATION_AND_STATUS' and next_status$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='update_provider_tracking_status(uuid,uuid,jsonb)';
 before_text:=$before$location_precision not in (1,3,5,10,20,40)$before$;after_text:=$after$location_precision not in (1,3,5,10,20)$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='update_provider_tracking_status(uuid,uuid,jsonb)';
 before_text:=$before$or location_lat not between -90 and 90$before$;after_text:=$after$or location_lat is null or location_lng is null or location_precision is null or location_lat not between -90 and 90$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='update_provider_tracking_location(uuid,uuid,jsonb)';
 before_text:=$before$location_precision not in (1,3,5,10,20,40)$before$;after_text:=$after$location_precision not in (1,3,5,10,20)$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='update_provider_tracking_location(uuid,uuid,jsonb)';
 before_text:=$before$or location_lat not between -90 and 90$before$;after_text:=$after$or location_lat is null or location_lng is null or location_precision is null or location_lat not between -90 and 90$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='update_provider_tracking_location(uuid,uuid,jsonb)';
 before_text:=$before$shipment.operational_status not in ('TO_PICKUP','IN_TRANSIT')$before$;after_text:=$after$shipment.operational_status in ('COMPLETED','CANCELLED')$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='provider_guest_tracking(uuid,text)';
 before_text:=$before$shipment.operational_status in ('TO_PICKUP','IN_TRANSIT')$before$;after_text:=$after$shipment.operational_status not in ('COMPLETED','CANCELLED')$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='provider_guest_tracking_for_recipient(uuid,text)';
 before_text:=$before$'recipient_role',recipient_role,$before$;after_text:=$after$'recipient_role',recipient_role,'can_approve',recipient_role='OWNER' and result->>'operational_status'='UNLOADING' and exists(select 1 from public.provider_shipment_events e where e.shipment_id=target_shipment_id and e.status='UNLOADING' and e.proof_storage_path is not null) and exists(select 1 from public.provider_shipment_events e where e.shipment_id=target_shipment_id and e.status='LOADING' and e.proof_storage_path is not null),$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='provider_tracking_detail(uuid,text)';
 before_text:=$before$'events',coalesce(events.records,'[]'::jsonb),$before$;after_text:=$after$'events',coalesce(events.records,'[]'::jsonb),'appeals',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'reason',a.reason,'status',a.status,'created_at',a.created_at,'resolution_note',a.resolution_note) order by a.created_at desc) from public.provider_tracking_appeals a where a.shipment_id=shipment.id),'[]'::jsonb),$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='tracking_recovery_context(uuid,uuid)';
 before_text:=$before$'assigned_vehicle_id',shipment.assigned_vehicle_id,$before$;after_text:=$after$'assigned_vehicle_id',shipment.assigned_vehicle_id,'cancel_allowed',public.managed_actor_has_permission(actor_user_id,'OPERATIONS') or shipment.tracking_mode='STATUS_ONLY' and shipment.operational_status in ('CREATED','TO_PICKUP'),$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
 signature:='recover_provider_tracking(uuid,uuid,jsonb)';
 before_text:=$before$ if action_value='CANCEL' then$before$;after_text:=$after$ if action_value='CANCEL' and (shipment.tracking_mode='LOCATION_AND_STATUS' or shipment.operational_status not in ('CREATED','TO_PICKUP')) and not public.managed_actor_has_permission(actor_user_id,'OPERATIONS') then raise exception 'TRACKING_STAFF_RELEASE_REQUIRED';end if;
 if action_value='CANCEL' then$after$;
 definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'HANDOVER_FUNCTION_DRIFT: %',signature;end if;
 execute replace(definition,before_text,after_text);
end;
$migration$;
