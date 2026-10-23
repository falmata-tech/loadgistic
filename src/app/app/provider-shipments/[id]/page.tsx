
import {displayStatus} from '@/lib/ui';
import {trackingNextStatuses} from '@/lib/tracking-progress.js';
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import {getTrackingRecovery} from '@/lib/lifecycle.js';
import {TrackingRecoveryControls} from '@/components/lifecycle-controls';
import {TrackingProofLink} from '@/components/tracking-proof-link';
import {DemoTrackingLabel} from '@/components/demo-tracking-label';
import {isDemoTrackingShipment} from '@/lib/demo-tracking-identity.js';
import { notFound, redirect } from 'next/navigation';
import {ArrowLeft,CalendarClock,KeyRound,Link2,PackageCheck,ShieldAlert,Star,Truck,UserRoundCheck,UserRoundX} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getProviderShipment } from '@/lib/provider-tracking.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { ProviderTrackingControls } from '@/components/provider-tracking-controls';
import {TrackingLocationMap} from '@/components/tracking-location-map';
import {trackingMapData} from '@/components/tracking-map-data';
import {providerWorkspaceCapabilities} from '@/lib/provider-workspace.js';
import {WorkspaceTaskDialog} from '@/components/workspace-task-dialog';
import styles from '@/components/tracking-record.module.css';

export default async function ProviderShipmentPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(undefined,{allowLimited:true});
  if(!['TRANSPORTER','DRIVER'].includes(user.role))redirect('/app/home');
  const {id}=await params,query=await searchParams;
  const shipment:any=await getProviderShipment(user,id);
  if(!shipment)notFound();
  const demo=isDemoTrackingShipment(shipment.id);
  const next=trackingNextStatuses(shipment.operational_status);
  const recovery=await getTrackingRecovery(user,shipment.id);
  const mapShipment=trackingMapData(shipment);
  const selfAssigned=providerWorkspaceCapabilities(user).drivesTruck&&shipment.assigned_driver_user_id===user.id;
  return <div className={`page tracking-detail-page ${styles.page}`}><PageHeader icon={PackageCheck} title={<><Text message="Tracking"/> · {shipment.code}</>} subtitle={mapShipment.route.map(point=>point.label).join(' → ')||`${shipment.origin} → ${shipment.destination}`} action={<Link className="button secondary" href="/app/provider-shipments"><ArrowLeft aria-hidden="true"/><Text message="Tracking"/></Link>}/>{demo?<DemoTrackingLabel/>:null}<Flash error={query.error} success={query.success}/>
    <TrackingLocationMap shipment={mapShipment}>
      {shipment.operational_status==='UNLOADING'?<section className="card"><h2><Text message="Waiting for shipment owner approval"/></h2><p><Text message="The shipment owner can approve unloading from their tracking page. If approval is delayed or disputed, ask our team to review."/></p>{selfAssigned?<form action={`/api/provider-shipments/${id}/appeal`} method="post" className="stack"><label><Text message="Explain the approval problem"/><textarea name="reason" minLength={5} maxLength={1000} required/></label><button className="button secondary"><Text message="Ask the team to review"/></button></form>:null}{shipment.appeals?.map((appeal:any)=><p key={appeal.id}>{appeal.reason} · <Text message={appeal.status}/>{appeal.resolution_note?` · ${appeal.resolution_note}`:''}</p>)}</section>:null}
      <ProviderTrackingControls key={shipment.id} trackingId={shipment.id} trackingMode={shipment.tracking_mode} operationalStatus={shipment.operational_status} nextStatuses={next} recordedStatuses={shipment.events.map((event:{status:string})=>event.status)} allowDeviceLocation={selfAssigned} defaultPrecisionKm={Number(shipment.latest_location?.location_precision_km)||undefined}/>
    </TrackingLocationMap>
    <Localized as="section" copy={['aria-label']} className={`provider-shipment-summary ${styles.summary}`} aria-label="Shipment details">
      <header className={styles.summaryHeader}><div><small><Text message="Cargo"/></small><h2>{shipment.cargo_summary}</h2></div><StatusPill status={shipment.operational_status}/><TrackingRecoveryControls context={recovery}/></header>
      <dl className={styles.facts}>
        <div><dt><Text message="Vehicle"/></dt><dd>{shipment.platform_number}</dd></div><div><dt><Text message="Driver"/></dt><dd>{shipment.driver_name}</dd></div>
        <div><dt><Text message="Pickup"/></dt><dd>{shipment.expected_pickup_date?new Date(`${shipment.expected_pickup_date}T12:00:00`).toLocaleDateString():<Text message="Not set"/>}</dd></div>
        <div><dt><Text message="Delivery"/></dt><dd>{shipment.expected_delivery_date?new Date(`${shipment.expected_delivery_date}T12:00:00`).toLocaleDateString():<Text message="Not set"/>}</dd></div>
      </dl>
    </Localized>
    <div className={styles.record}><section className={styles.section}><header><h2><CalendarClock aria-hidden="true"/><Text message="Status timeline"/></h2></header><ol className={styles.timeline}>{shipment.events.map((event:any)=><li key={event.id}><div><strong><Text message={displayStatus(event.status)}/></strong>{demo?<DemoTrackingLabel kind="event"/>:null}<p>{event.note||<Text message="Status updated"/>}</p>{event.has_proof?<TrackingProofLink shipmentId={shipment.id} eventId={event.id}/>:null}<time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></div></li>)}</ol></section>
      <aside className={styles.aside}><TrackingPartyCard shipment={shipment}/>
      {shipment.email_deliveries?.length?<section className="card"><h3><Text message="Customer email"/></h3>{shipment.email_deliveries.map((delivery:any,index:number)=><p key={`${delivery.delivery_kind}-${delivery.party_role}-${index}`}><strong>{delivery.delivery_kind==='TRACKING_ACCESS'?<Text message="Tracking access"/>:<Text message="Completion record"/>}:</strong> {delivery.status.toLowerCase()}{delivery.attempts?` · ${delivery.attempts} attempt${delivery.attempts===1?'':'s'}`:''}</p>)}</section>:null}
      {shipment.review?<section className="card provider-review-card"><h3><Star aria-hidden="true"/><Text message="Customer owner review"/></h3><strong>{'★'.repeat(shipment.review.rating)}{'☆'.repeat(5-shipment.review.rating)}</strong><p>{shipment.review.note||'No written comment.'}</p><span className="status blue"><Text message="Published"/></span>{shipment.review.dispute_status==='PENDING'?<p className="permission-note warning"><Text message="Dispute pending. The rating stays visible and counted during review."/></p>:shipment.review.rating<=3?<WorkspaceTaskDialog title="Dispute this review" triggerLabel="Dispute this review" icon={<ShieldAlert aria-hidden="true"/>}><form action={`/api/provider-reviews/${shipment.review.id}/dispute`} method="post" className="stack"><input type="hidden" name="shipmentId" value={shipment.id}/><div className="form-group"><label htmlFor="review-dispute"><Text message="Reason"/></label><textarea id="review-dispute" name="reason" minLength={5} maxLength={1000} required/></div><button className="button"><Text message="Submit dispute"/></button></form></WorkspaceTaskDialog>:null}</section>:null}</aside>
    </div>
  </div>;
}

function TrackingPartyCard({shipment}:{shipment:any}){
  const recipients=Array.isArray(shipment.tracking_recipients)?shipment.tracking_recipients:[];
  const owner=recipients.find((recipient:{recipient_role:string})=>recipient.recipient_role==='OWNER');
  return <section className={`card ${styles.party}`}><h3><UserRoundCheck aria-hidden="true"/><Text message="Shipment owner"/></h3>
    {owner?<p><strong>{owner.recipient_email}</strong></p>:null}
    <p className="meta"><Text message="The shipment owner manages who can follow this shipment."/></p>
    {shipment.tracking_access_code?<p><Link2 aria-hidden="true"/> <Link href={shipment.tracking_path}><Text message="Open public Track page"/></Link></p>:<p className="meta"><Text message="Guest access has expired."/></p>}
    {shipment.guest_expires_at?<p className="meta"><Text message="Guest access expires "/>{new Date(shipment.guest_expires_at).toLocaleString()}.</p>:null}
  </section>;
}
