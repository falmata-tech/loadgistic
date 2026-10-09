-- FEAT-TRK-001 / NR-08/10: temporary guest identity must not block history retention.
alter table public.provider_shipment_events add column handover_approval_kind text
 check(handover_approval_kind is null or (handover_approval_kind in ('OWNER','STAFF') and status='COMPLETED'));

-- Backfill only a recorded approval tied to the same shipment and owner.
update public.provider_shipment_events e set handover_approval_kind='OWNER'
where e.status='COMPLETED' and e.created_by is null and e.approved_by_recipient_id is not null
 and exists(select 1 from public.provider_tracking_recipients r
 join public.provider_shipments s on s.id=r.shipment_id
 where r.id=e.approved_by_recipient_id and r.shipment_id=e.shipment_id and r.recipient_role='OWNER'
 and s.handover_approval_kind='OWNER' and s.handover_approved_at is not null);

alter table public.provider_shipment_events drop constraint tracking_event_actor_required;
alter table public.provider_shipment_events add constraint tracking_event_actor_required
 check(created_by is not null or (status='COMPLETED' and handover_approval_kind is not distinct from 'OWNER'));
alter table public.provider_shipment_events drop constraint provider_shipment_events_approved_by_recipient_id_fkey;
alter table public.provider_shipment_events add constraint provider_shipment_events_approved_by_recipient_id_fkey
 foreign key(approved_by_recipient_id) references public.provider_tracking_recipients(id) on delete set null;

do $migration$
declare definition text;before_text text;after_text text;
begin
 definition:=pg_get_functiondef('public.complete_provider_handover(uuid,uuid,text,uuid)'::regprocedure);
 before_text:='created_by,created_at,approved_by_recipient_id)';
 after_text:='created_by,created_at,approved_by_recipient_id,handover_approval_kind)';
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'APPROVAL_RETENTION_INSERT_DRIFT';end if;
 definition:=replace(definition,before_text,after_text);
 before_text:='actor_user_id,stamp,recipient_id);';
 after_text:='actor_user_id,stamp,recipient_id,approval_kind);';
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'APPROVAL_RETENTION_VALUES_DRIFT';end if;
 execute replace(definition,before_text,after_text);
end $migration$;
comment on column public.provider_shipment_events.handover_approval_kind is
 'Private historical approval marker; no contact data or guest-access authority. Retained after temporary recipient cleanup.';
notify pgrst,'reload schema';
