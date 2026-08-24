import { notFound, redirect } from 'next/navigation';
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
  if(!grant)redirect('/track?error=Enter+the+private+shipment+code+to+open+tracking.');
  const shipment:any=await getProviderGuestTracking(id,grant.partyRole);
  if(!shipment)notFound();
  const reviewAuthorized=await hasProviderReviewGrant(id);
  const canReview=Boolean(shipment.can_review&&reviewAuthorized);
  const needsReviewCode=shipment.operational_status==='COMPLETED'&&!shipment.review&&!canReview;
  const statusLabels:Record<string,string>={CREATED:'Tracking started',TO_PICKUP:'Going to pickup',LOADING:'Loading',IN_TRANSIT:'En route',UNLOADING:'Unloading',COMPLETED:'Complete',ISSUE:'Problem'};
  const trackingMapShipment=shipment.current_location?{origin:shipment.origin,origin_lat:Number(shipment.origin_lat),origin_lng:Number(shipment.origin_lng),destination:shipment.destination,destination_lat:Number(shipment.destination_lat),destination_lng:Number(shipment.destination_lng),operational_status:shipment.operational_status,current_location:{location_area:shipment.current_location.location_area,location_lat:Number(shipment.current_location.location_lat),location_lng:Number(shipment.current_location.location_lng),location_precision_km:Number(shipment.current_location.location_precision_km),updated_at:shipment.current_location.updated_at}}:null;

  return <><PublicHeader/><main className="public-app-page tracking-public-workspace"><div className="container tracking-public-container">
    <Flash error={query.error} success={query.success}/>
    <div className="tracking-public-heading"><div><p className="eyebrow">Private shipment tracking</p><h1>Track {shipment.code}</h1><p>{shipment.origin} → {shipment.destination}</p></div><div className="stack status-stack"><StatusPill status={shipment.operational_status}/><TrackingIdleGuard shipmentId={shipment.id}/></div></div>
    <div className="tracking-mode-banner"><strong>{shipment.tracking_mode==='LOCATION_AND_STATUS'?'Location and status updates':'Status updates'}</strong><span>Updates come from the transporter. Confirm cargo, pickup, delivery, and timing directly with them.</span></div>
    {trackingMapShipment?<TrackingLocationMap shipment={trackingMapShipment}/>:shipment.tracking_mode==='LOCATION_AND_STATUS'&&['TO_PICKUP','IN_TRANSIT'].includes(shipment.operational_status)?<div className="tracking-location-waiting"><LocateFixed aria-hidden="true"/><span><strong>Waiting for the Driver’s approximate location</strong><small>Status updates remain available while the Driver reconnects.</small></span></div>:null}
    <div className="two-col tracking-public-grid"><section className="card"><h2>Shipment progress</h2><ol className="timeline">{shipment.events.map((event:any)=><li key={event.id}><strong>{statusLabels[event.status]||event.status.replaceAll('_',' ')}</strong><div>{event.note||'Status updated'}</div><div className="meta">{new Date(event.created_at).toLocaleString()}</div></li>)}</ol></section><aside className="stack">
      <section className="card"><h3>Shipment details</h3><p><strong>Cargo:</strong> {shipment.cargo_summary}</p><p><strong>Transporter:</strong> {shipment.provider_name}</p><p><strong>Truck:</strong> {shipment.platform_number} · {shipment.vehicle_make} {shipment.vehicle_model}</p><p className="meta">Loadgistic shares the transporter&apos;s updates; the transporter remains responsible for the service.</p></section>
      {canReview?<section className="card"><h3>Review the provider</h3><p className="meta">After delivery, the person who received the completion email may leave one verified review.</p><form action={`/api/tracking/${shipment.id}/review`} method="post" className="stack"><div className="form-group"><label htmlFor="rating">Rating</label><select id="rating" name="rating" required defaultValue=""><option value="" disabled>Choose 1–5 stars</option>{[5,4,3,2,1].map(value=><option value={value} key={value}>{value} star{value===1?'':'s'}</option>)}</select></div><div className="form-group"><label htmlFor="review-note">Comment <span className="meta">(optional)</span></label><textarea id="review-note" name="note" maxLength={1000}/></div><button className="button">Publish review</button></form></section>:needsReviewCode?<section className="card"><h3>Verify your review</h3><p className="meta">Enter the separate review code from the completion email. The shared tracking code cannot publish a review.</p><form action="/api/tracking/review-unlock" method="post" className="stack"><input type="hidden" name="shipmentId" value={shipment.id}/><div className="form-group"><label htmlFor="review-code"><KeyRound aria-hidden="true"/>Review code</label><input id="review-code" name="reviewCode" autoComplete="off" required/></div><button className="button secondary">Continue to review</button></form></section>:shipment.review?<section className="card"><h3>Your review</h3><strong>{'★'.repeat(shipment.review.rating)}{'☆'.repeat(5-shipment.review.rating)}</strong><p>{shipment.review.note||'No written comment.'}</p><span className="status blue">Published</span></section>:null}
    </aside></div>
  </div></main></>;
}
