
import {Text,Localized} from '@/components/localization';
import {redirect} from 'next/navigation';
import {TrackingProofLink} from '@/components/tracking-proof-link';
import { KeyRound, LocateFixed } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { Flash } from '@/components/flash';
import { getProviderGuestTracking } from '@/lib/provider-tracking.js';
import { StatusPill } from '@/components/status-pill';
import { getProviderTrackingGrant, hasProviderReviewGrant } from '@/lib/auth';
import { TrackingIdleGuard } from '@/components/tracking-idle-guard';
import { TrackingLocationMap } from '@/components/tracking-location-map';

export default async function TrackPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const {id}=await params;
  const query=await searchParams;
  const grant=await getProviderTrackingGrant(id);
  if(!grant)redirect('/track?error=Verify+your+approved+email+and+Tracking+code+to+continue.');
  const shipment:any=await getProviderGuestTracking(id,grant.recipientDigest);
  if(!shipment)redirect('/track?error=Tracking+access+changed.+Verify+your+email+again.');
  const isCustomerOwner=shipment.recipient_role==='OWNER';
  const reviewAuthorized=await hasProviderReviewGrant(id);
  const canReview=Boolean(isCustomerOwner&&shipment.can_review&&reviewAuthorized);
  const needsReviewCode=isCustomerOwner&&shipment.operational_status==='COMPLETED'&&!shipment.review&&!canReview;
  const statusLabels:Record<string,string>={CREATED:'Tracking started',TO_PICKUP:'Going to pickup',LOADING:'Loading',IN_TRANSIT:'En route',UNLOADING:'Unloading',COMPLETED:'Complete',ISSUE:'Problem'};
  const trackingMapShipment=shipment.current_location?{origin:shipment.origin,origin_lat:Number(shipment.origin_lat),origin_lng:Number(shipment.origin_lng),destination:shipment.destination,destination_lat:Number(shipment.destination_lat),destination_lng:Number(shipment.destination_lng),operational_status:shipment.operational_status,current_location:{location_area:shipment.current_location.location_area,location_lat:Number(shipment.current_location.location_lat),location_lng:Number(shipment.current_location.location_lng),location_precision_km:Number(shipment.current_location.location_precision_km),updated_at:shipment.current_location.updated_at}}:null;

  return <><PublicHeader/><main className="public-app-page tracking-public-workspace"><div className="container tracking-public-container">
    <Flash error={query.error} success={query.success}/>
    <div className="tracking-public-heading"><div><p className="eyebrow"><Text message="Private shipment tracking"/></p><h1><Text message="Track "/>{shipment.code}</h1><p>{shipment.origin} → {shipment.destination}</p></div><div className="stack status-stack"><StatusPill status={shipment.operational_status}/><TrackingIdleGuard shipmentId={shipment.id}/></div></div>
    <div className="tracking-mode-banner"><strong>{shipment.tracking_mode==='LOCATION_AND_STATUS'?<Text message="Location and status updates"/>:<Text message="Status updates"/>}</strong><span><Text message="Updates come from the transporter. Confirm cargo, pickup, delivery, and timing directly with them."/>{shipment.tracking_mode==='LOCATION_AND_STATUS'?<Text message=" Location updates require the Driver’s open, visible Tracking screen and pause when it closes or the phone locks."/>:''}</span></div>
    {trackingMapShipment?<TrackingLocationMap shipment={trackingMapShipment}/>:shipment.tracking_mode==='LOCATION_AND_STATUS'&&['TO_PICKUP','IN_TRANSIT'].includes(shipment.operational_status)?<div className="tracking-location-waiting"><LocateFixed aria-hidden="true"/><span><strong><Text message="Waiting for the Driver’s approximate location"/></strong><small><Text message="Status updates remain available while the Driver reconnects."/></small></span></div>:null}
    <div className="two-col tracking-public-grid"><section className="card"><h2><Text message="Shipment progress"/></h2><ol className="timeline">{shipment.events.map((event:any)=><li key={event.id}><strong>{statusLabels[event.status]||event.status.replaceAll('_',' ')}</strong><div>{event.note||'Status updated'}</div>{event.has_proof?<TrackingProofLink shipmentId={shipment.id} eventId={event.id}/>:null}<div className="meta">{new Date(event.created_at).toLocaleString()}</div></li>)}</ol></section><aside className="stack">
      <section className="card"><h3><Text message="Shipment details"/></h3><p><strong><Text message="Cargo:"/></strong> {shipment.cargo_summary}</p><p><strong><Text message="Transporter:"/></strong> {shipment.provider_name}</p><p><strong><Text message="Truck:"/></strong> {shipment.platform_number} · {shipment.vehicle_make} {shipment.vehicle_model}</p><p className="meta"><Text message="Loadgistic shares the transporter's updates; the transporter remains responsible for the service."/></p></section>
      {canReview?<section className="card"><h3><Text message="Review the provider"/></h3><p className="meta"><Text message="After delivery, the person who received the completion email may leave one verified review."/></p><form action={`/api/tracking/${shipment.id}/review`} method="post" className="stack"><div className="form-group"><label htmlFor="rating"><Text message="Rating"/></label><select id="rating" name="rating" required defaultValue=""><option value="" disabled><Text message="Choose 1–5 stars"/></option>{[5,4,3,2,1].map(value=><option value={value} key={value}>{value}<Text message=" star"/>{value===1?'':'s'}</option>)}</select></div><div className="form-group"><label htmlFor="review-note"><Text message="Comment "/><span className="meta"><Text message="(optional)"/></span></label><textarea id="review-note" name="note" maxLength={1000}/></div><button className="button"><Text message="Publish review"/></button></form></section>:needsReviewCode?<section className="card"><h3><Text message="Verify your review"/></h3><p className="meta"><Text message="Enter the separate review code from the completion email. The shared tracking code cannot publish a review."/></p><form action="/api/tracking/review-unlock" method="post" className="stack"><input type="hidden" name="shipmentId" value={shipment.id}/><div className="form-group"><label htmlFor="review-code"><KeyRound aria-hidden="true"/><Text message="Review code"/></label><Localized as="input" copy={["placeholder"]} id="review-code" name="reviewCode" autoComplete="off" autoCapitalize="characters" placeholder="LG-RV-XXXX-XXXX-XXXX-XXXX" maxLength={25} spellCheck={false} required/></div><button className="button secondary"><Text message="Continue to review"/></button></form></section>:shipment.review?<section className="card"><h3><Text message="Your review"/></h3><strong>{'★'.repeat(shipment.review.rating)}{'☆'.repeat(5-shipment.review.rating)}</strong><p>{shipment.review.note||'No written comment.'}</p><span className="status blue"><Text message="Published"/></span></section>:null}
    </aside></div>
  </div></main></>;
}
