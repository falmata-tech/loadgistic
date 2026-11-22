-- FEAT-TRK-001. Replace the read projection in place, preserving grants.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create or replace function public.read_tracking_session_link(link_digest text,code_digest text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare l public.tracking_session_links%rowtype;s public.tracking_sessions%rowtype;expiry timestamptz;
begin
 if link_digest is null or code_digest is null or link_digest!~'^[a-f0-9]{64}$' or code_digest!~'^[a-f0-9]{64}$' then return null;end if;
 select *into l from public.tracking_session_links x where x.link_digest=read_tracking_session_link.link_digest and x.code_digest=read_tracking_session_link.code_digest and x.revoked_at is null and x.expires_at>clock_timestamp();
 if not found then return null;end if;
 select *into s from public.tracking_sessions where id=l.session_id;
 if not found or public.tracking229_source_active(s) is distinct from true then return null;end if;
 if s.origin_kind='AUTHORIZED_SHIPMENT' and s.workspace_id is not null and public.tracking_business_share_active(s.shipment_id,s.workspace_id) is distinct from true then return null;end if;
 -- A guest credential delegates its issuer's access to this shipment.
 if l.created_by is null or public.tracking229_can_manage(l.created_by,s) is distinct from true then return null;end if;
 expiry:=l.expires_at;
 if s.state='PENDING_PROVIDER' then expiry:=least(expiry,s.pending_expires_at);else
  select least(expiry,coalesce(p.guest_expires_at,expiry)) into expiry from public.provider_shipments p where p.id=s.shipment_id;
 end if;
 return jsonb_build_object('id',s.id,'sessionId',s.id,'state',s.state,'expiresAt',expiry,'shipmentId',s.shipment_id,'reference',s.reference,'route',s.route,
 'cargoSummary',s.cargo_summary,'pickupDate',s.pickup_date,'deliveryDate',s.delivery_date,'shipment',public.tracking229_shipment_projection(s,l.allow_location and public.tracking229_can_locate(l.created_by,s) is true));
end $$;
commit;
