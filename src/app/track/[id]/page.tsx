import Link from 'next/link';

import {Text} from '@/components/localization';
import {redirect} from 'next/navigation';
import {TrackingProofLink} from '@/components/tracking-proof-link';
import {DemoTrackingLabel} from '@/components/demo-tracking-label';
import {isDemoTrackingShipment} from '@/lib/demo-tracking-identity.js';
import { PublicHeader } from '@/components/public-header';
import { Flash } from '@/components/flash';
import { getProviderGuestTracking } from '@/lib/provider-tracking.js';
import { StatusPill } from '@/components/status-pill';
import { getProviderTrackingGrant } from '@/lib/auth';
import { TrackingSessionBoundary } from '@/components/tracking-idle-guard';
import { TrackingLocationMap } from '@/components/tracking-location-map';
import {TrackingAutoRefresh} from '@/components/tracking-auto-refresh';
import {trackingMapData} from '@/components/tracking-map-data';
import {trackingRefreshState} from '@/lib/tracking-refresh-revision.js';
import {TrackingSharing} from '@/components/tracking-sharing';
import {getCurrentUser} from '@/lib/auth';
import {providerTrackingRecipientDigest} from '@/lib/security.js';
import {locationSourceLabel} from '@/lib/location-source.js';

export default async function TrackPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const {id}=await params;
  const query=await searchParams;
  const grant=await getProviderTrackingGrant(id);
  if(!grant)redirect('/track?error=Verify+your+email+to+continue.');
  const shipment:any=await getProviderGuestTracking(id,grant.recipientDigest);
  if(!shipment)redirect('/track?error=Tracking+access+changed.+Verify+your+email+again.');
  const demo=isDemoTrackingShipment(shipment.id);
  const isCustomerOwner=shipment.recipient_role==='OWNER';
  const canReview=Boolean(isCustomerOwner&&shipment.can_review);
  const member=isCustomerOwner?await getCurrentUser():null;
  const businesses=member?.email&&providerTrackingRecipientDigest(member.email)===grant.recipientDigest?
    (member.business_workspaces||[]).filter(item=>item.permissions.tracking).map(({id,name,handle})=>({id,name,handle})):[];
  const statusLabels:Record<string,string>={CREATED:'Tracking started',TO_PICKUP:'Going to pickup',LOADING:'Loading',IN_TRANSIT:'En route',UNLOADING:'Unloading',COMPLETED:'Complete',ISSUE:'Problem'};
  const trackingMapShipment=trackingMapData(shipment);
  const refresh=trackingRefreshState(shipment);

  return <><PublicHeader/><main className="public-app-page tracking-public-workspace tracking-detail-page"><TrackingSessionBoundary initialExpiresAt={grant.expiresAt}><div className="container tracking-public-container">
    <Link className="text-button" href="/track"><Text message="All shipments"/></Link>
    <Flash error={query.error} success={query.success}/>
    <div className="tracking-public-heading"><div><p className="eyebrow"><Text message="Private shipment tracking"/></p><h1><Text message="Track "/>{shipment.code}</h1>{demo?<DemoTrackingLabel/>:null}<p>{trackingMapShipment.route.map(point=>point.label).join(' → ')||`${shipment.origin} → ${shipment.destination}`}</p></div><div className="stack status-stack"><StatusPill status={shipment.operational_status}/><TrackingAutoRefresh shipmentId={id} revision={refresh.revision} active={refresh.active} expiresAt={grant.expiresAt}/></div></div>
    <TrackingLocationMap shipment={trackingMapShipment}/>
    <div className="tracking-mode-banner"><strong><Text message={trackingMapShipment.trackingMode==='LOCATION_AND_STATUS'?'Location and status updates':'Status updates'}/></strong><span><Text message="Updates come from the transporter. Confirm cargo, pickup, delivery, and timing directly with them."/></span>{trackingMapShipment.location?.source?<span><Text message={locationSourceLabel(trackingMapShipment.location.source)}/></span>:null}</div>
    <div className="two-col tracking-public-grid"><section className="card"><h2><Text message="Shipment progress"/></h2><ol className="timeline">{shipment.events.map((event:any)=><li key={event.id}><strong>{statusLabels[event.status]||event.status.replaceAll('_',' ')}</strong>{demo?<DemoTrackingLabel kind="event"/>:null}<div>{event.note||'Status updated'}</div>{event.has_proof?<TrackingProofLink shipmentId={shipment.id} eventId={event.id}/>:null}<div className="meta">{new Date(event.created_at).toLocaleString()}</div></li>)}</ol></section><aside className="stack">
      {isCustomerOwner&&shipment.can_share?<TrackingSharing shipmentId={shipment.id} businesses={businesses}/>:null}
      <section className="card"><h3><Text message="Shipment details"/></h3><p><strong><Text message="Cargo:"/></strong> {shipment.cargo_summary}</p><p><strong><Text message="Transporter:"/></strong> {shipment.provider_name}</p><p><strong><Text message="Vehicle:"/></strong> {shipment.platform_number} · {shipment.vehicle_make} {shipment.vehicle_model}</p><p className="meta"><Text message="Loadgistic shares the transporter's updates; the transporter remains responsible for the service."/></p></section>
      {shipment.can_approve?<section className="card handover-approval"><h3><Text message="Approve unloading"/></h3>{demo?<DemoTrackingLabel kind="approval"/>:null}<p><Text message="Check the unloading photo and confirm the shipment has arrived. Your approval completes this shipment."/></p><form action={`/api/tracking/${shipment.id}/approve`} method="post"><button className="button"><Text message="Approve unloading"/></button></form></section>:null}
      {canReview?<section className="card"><h3><Text message="Review the provider"/></h3><p className="meta"><Text message="After delivery, the person who received the completion email may leave one verified review."/></p><form action={`/api/tracking/${shipment.id}/review`} method="post" className="stack"><div className="form-group"><label htmlFor="rating"><Text message="Rating"/></label><select id="rating" name="rating" required defaultValue=""><option value="" disabled><Text message="Choose 1–5 stars"/></option>{[5,4,3,2,1].map(value=><option value={value} key={value}>{value}<Text message=" star"/>{value===1?'':'s'}</option>)}</select></div><div className="form-group"><label htmlFor="review-note"><Text message="Comment "/><span className="meta"><Text message="(optional)"/></span></label><textarea id="review-note" name="note" maxLength={1000}/></div><label><input type="checkbox" name="termsAccepted" value="yes" required/><Text message="I agree to the Terms and content rules."/> <Link href="/terms" target="_blank"><Text message="Terms"/></Link></label><button className="button"><Text message="Publish review"/></button></form></section>:shipment.review?<section className="card"><h3><Text message="Your review"/></h3><strong>{'★'.repeat(shipment.review.rating)}{'☆'.repeat(5-shipment.review.rating)}</strong><p>{shipment.review.note||'No written comment.'}</p><span className="status blue"><Text message="Published"/></span></section>:null}
    </aside></div>
  </div></TrackingSessionBoundary></main></>;
}
