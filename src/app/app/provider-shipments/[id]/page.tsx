import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {ArrowLeft,CalendarClock,KeyRound,Link2,MailPlus,PackageCheck,ShieldAlert,Star,Truck,UserRoundCheck,UserRoundX} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getProviderShipment } from '@/lib/provider-tracking.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { ProviderTrackingControls } from '@/components/provider-tracking-controls';

const transitions:Record<string,string[]>={CREATED:['TO_PICKUP','LOADING','ISSUE'],TO_PICKUP:['LOADING','ISSUE'],LOADING:['IN_TRANSIT','ISSUE'],IN_TRANSIT:['UNLOADING','ISSUE'],UNLOADING:['COMPLETED','ISSUE'],ISSUE:['TO_PICKUP','LOADING','IN_TRANSIT','UNLOADING']};
export default async function ProviderShipmentPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser();
  if(!['TRANSPORTER','DRIVER'].includes(user.role))redirect('/app/home');
  const {id}=await params,query=await searchParams;
  const shipment:any=await getProviderShipment(user,id);
  if(!shipment)notFound();
  const next=transitions[shipment.operational_status]||[];
  return <div className="page"><PageHeader icon={PackageCheck} title={`Tracking · ${shipment.code}`} subtitle={`${shipment.origin} → ${shipment.destination}`} action={<Link className="button secondary" href="/app/provider-shipments"><ArrowLeft aria-hidden="true"/>Tracking</Link>}/><Flash error={query.error} success={query.success}/>
    <section className="provider-shipment-summary">
      <article><span>Cargo</span><strong>{shipment.cargo_summary}</strong></article><article><span>Truck</span><strong><Truck aria-hidden="true"/>{shipment.platform_number}</strong></article><article><span>Driver</span><strong>{shipment.driver_name}</strong></article><article><span>Status</span><StatusPill status={shipment.operational_status}/></article>
      <article><span>Pickup</span><strong>{shipment.expected_pickup_date?new Date(`${shipment.expected_pickup_date}T12:00:00`).toLocaleDateString():'Not set'}</strong></article><article><span>Delivery</span><strong>{shipment.expected_delivery_date?new Date(`${shipment.expected_delivery_date}T12:00:00`).toLocaleDateString():'Not set'}</strong></article>
    </section>
    <ProviderTrackingControls trackingId={shipment.id} trackingMode={shipment.tracking_mode} operationalStatus={shipment.operational_status} nextStatuses={next} allowDeviceLocation={user.role==='DRIVER'&&shipment.assigned_driver_user_id===user.id} defaultPrecisionKm={Number(shipment.latest_location?.location_precision_km)||20}/>
    <div className="two-col"><section className="card"><h2 className="panel-heading"><CalendarClock aria-hidden="true"/>Customer-safe timeline</h2><ol className="timeline">{shipment.events.map((event:any)=><li key={event.id}><strong>{event.status.replaceAll('_',' ')}</strong><p>{event.note||'Status updated'}</p>{event.has_proof?<span className="status blue">Proof recorded</span>:null}<div className="meta">{new Date(event.created_at).toLocaleString()}</div></li>)}</ol></section>
      <aside className="stack"><TrackingPartyCard shipment={shipment}/>
      {shipment.email_deliveries?.length?<section className="card"><h3>Customer email</h3>{shipment.email_deliveries.map((delivery:any,index:number)=><p key={`${delivery.delivery_kind}-${delivery.party_role}-${index}`}><strong>{delivery.delivery_kind==='TRACKING_ACCESS'?'Tracking access':'Completion record'}:</strong> {delivery.status.toLowerCase()}{delivery.attempts?` · ${delivery.attempts} attempt${delivery.attempts===1?'':'s'}`:''}</p>)}</section>:null}
      {shipment.review?<section className="card provider-review-card"><h3><Star aria-hidden="true"/>Customer owner review</h3><strong>{'★'.repeat(shipment.review.rating)}{'☆'.repeat(5-shipment.review.rating)}</strong><p>{shipment.review.note||'No written comment.'}</p><span className="status blue">Published</span>{shipment.review.dispute_status==='PENDING'?<p className="permission-note warning">Dispute pending. The rating stays visible and counted during review.</p>:shipment.review.rating<=3?<form action={`/api/provider-reviews/${shipment.review.id}/dispute`} method="post" className="stack"><input type="hidden" name="shipmentId" value={shipment.id}/><div className="form-group"><label htmlFor="review-dispute">Dispute this review</label><textarea id="review-dispute" name="reason" minLength={5} maxLength={1000} required/></div><button className="button secondary"><ShieldAlert aria-hidden="true"/>Submit dispute</button></form>:null}</section>:null}</aside>
    </div>
  </div>;
}

function TrackingPartyCard({shipment}:{shipment:any}){
  const recipients=Array.isArray(shipment.tracking_recipients)?shipment.tracking_recipients:[];
  const mayAdd=shipment.operational_status!=='COMPLETED'&&shipment.guest_access_active;
  return <section className="card stack"><h3><UserRoundCheck aria-hidden="true"/>Tracking parties</h3>
    <div className="stack">{recipients.map((recipient:any)=><div className="list-row compact" key={recipient.id}><div><strong>{recipient.recipient_email}</strong><div className="meta">{recipient.recipient_role==='OWNER'?'Customer owner':recipient.revoked_at?'Access revoked':'Tracking party'}</div></div>{recipient.recipient_role!=='OWNER'&&!recipient.revoked_at&&mayAdd?<form action={`/api/provider-shipments/${shipment.id}/recipients`} method="post"><input type="hidden" name="action" value="REVOKE"/><input type="hidden" name="recipientId" value={recipient.id}/><button className="button secondary small"><UserRoundX aria-hidden="true"/>Revoke</button></form>:null}</div>)}</div>
    {shipment.tracking_access_code?<><div className="tracking-secret"><KeyRound aria-hidden="true"/><div><span>Shipment Tracking code</span><strong>{shipment.tracking_access_code}</strong></div></div><p><Link2 aria-hidden="true"/> <Link href={shipment.tracking_path}>Open public Track page</Link></p><p className="meta">Each approved person enters this code with their own email, then verifies a one-time code.</p></>:<p className="meta">Guest access has expired.</p>}
    {mayAdd?<form action={`/api/provider-shipments/${shipment.id}/recipients`} method="post" className="stack"><input type="hidden" name="action" value="ADD"/><div className="form-group"><label htmlFor="tracking-party-email"><MailPlus aria-hidden="true"/>Add tracking party</label><input id="tracking-party-email" name="email" type="email" autoComplete="email" required/></div><button className="button secondary"><MailPlus aria-hidden="true"/>Add and email access</button></form>:null}
    {shipment.guest_expires_at?<p className="meta">Guest access expires {new Date(shipment.guest_expires_at).toLocaleString()}.</p>:null}
  </section>;
}
