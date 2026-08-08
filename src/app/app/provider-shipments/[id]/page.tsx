import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, FileUp, MapPin, PackageCheck, ShieldAlert, Star, Truck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getProviderShipment } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';

const transitions:Record<string,string[]>={CREATED:['LOADING','ISSUE'],LOADING:['IN_TRANSIT','ISSUE'],IN_TRANSIT:['UNLOADING','ISSUE'],UNLOADING:['COMPLETED','ISSUE'],ISSUE:['IN_TRANSIT','UNLOADING']};
const labels:Record<string,string>={LOADING:'Confirm loading',IN_TRANSIT:'Start transit',UNLOADING:'Confirm unloading',COMPLETED:'Complete shipment',ISSUE:'Report issue'};

export default async function ProviderShipmentPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser();
  if(!['TRANSPORTER','DRIVER'].includes(user.role))redirect('/app/home');
  const {id}=await params,query=await searchParams;
  const shipment:any=getProviderShipment(user,id);
  if(!shipment)notFound();
  const next=transitions[shipment.operational_status]||[];
  return <div className="page"><PageHeader icon={PackageCheck} title={shipment.code} subtitle={`${shipment.origin} → ${shipment.destination}`} action={<Link className="button secondary" href="/app/provider-shipments"><ArrowLeft aria-hidden="true"/>Shipments</Link>}/><Flash error={query.error} success={query.success}/>
    <section className="provider-shipment-summary">
      <article><span>Cargo</span><strong>{shipment.cargo_summary}</strong></article><article><span>Truck</span><strong><Truck aria-hidden="true"/>{shipment.platform_number}</strong></article><article><span>Driver</span><strong>{shipment.driver_name}</strong></article><article><span>Status</span><StatusPill status={shipment.operational_status}/></article>
      <article><span>Pickup</span><strong>{shipment.expected_pickup_date?new Date(`${shipment.expected_pickup_date}T12:00:00`).toLocaleDateString():'Not set'}</strong></article><article><span>Delivery</span><strong>{shipment.expected_delivery_date?new Date(`${shipment.expected_delivery_date}T12:00:00`).toLocaleDateString():'Not set'}</strong></article>
    </section>
    {next.length?<section className="card"><h2 className="panel-heading"><CheckCircle2 aria-hidden="true"/>Update shipment</h2><p className="meta">Proof is optional and appears only for loading, unloading, or an issue.</p><div className="provider-status-actions">{next.map(status=>{
      const proofAllowed=['LOADING','UNLOADING','ISSUE'].includes(status);
      return <form key={status} action={`/api/provider-shipments/${shipment.id}/status`} method="post" encType="multipart/form-data" className={status==='ISSUE'?'status-action issue':'status-action'}>
        <input type="hidden" name="nextStatus" value={status}/>
        {status==='ISSUE'?<div className="form-group"><label htmlFor={`issue-note-${shipment.id}`}><ShieldAlert aria-hidden="true"/>What happened?</label><textarea id={`issue-note-${shipment.id}`} name="note" required maxLength={1000}/></div>:<input type="hidden" name="note" value={labels[status]}/>}
        {proofAllowed?<div className="form-group"><label htmlFor={`proof-${status}`}><FileUp aria-hidden="true"/>Proof <span className="meta">(optional)</span></label><input id={`proof-${status}`} name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"/></div>:null}
        <button className={`button ${status==='ISSUE'?'secondary':''}`}>{status==='ISSUE'?<AlertTriangle aria-hidden="true"/>:<CheckCircle2 aria-hidden="true"/>}{labels[status]}</button>
      </form>;
    })}</div></section>:null}
    <div className="two-col"><section className="card"><h2 className="panel-heading"><CalendarClock aria-hidden="true"/>Customer-safe timeline</h2><ol className="timeline">{shipment.events.map((event:any)=><li key={event.id}><strong>{event.status.replaceAll('_',' ')}</strong><p>{event.note||'Status updated'}</p>{event.has_proof?<span className="status blue">Proof recorded</span>:null}<div className="meta">{new Date(event.created_at).toLocaleString()}</div></li>)}</ol></section>
      <aside className="stack"><section className="card"><h3><MapPin aria-hidden="true"/>Customer access</h3><p><strong>Shipper:</strong> {shipment.shipper_email}</p><p><strong>Receiver:</strong> {shipment.receiver_email}</p><p className="meta">Their private codes are never recoverable. If a code is lost, support must revoke and reissue access.</p>{shipment.guest_expires_at?<p className="meta">Guest data expires {new Date(shipment.guest_expires_at).toLocaleString()}.</p>:null}</section>
      {shipment.email_deliveries?.length?<section className="card"><h3>Completion email</h3>{shipment.email_deliveries.map((delivery:any)=><p key={delivery.party_role}><strong>{delivery.party_role.toLowerCase()}:</strong> {delivery.status.toLowerCase()}{delivery.attempts?` · ${delivery.attempts} attempt${delivery.attempts===1?'':'s'}`:''}</p>)}</section>:null}
      {shipment.review?<section className="card provider-review-card"><h3><Star aria-hidden="true"/>Shipper review</h3><strong>{'★'.repeat(shipment.review.rating)}{'☆'.repeat(5-shipment.review.rating)}</strong><p>{shipment.review.note||'No written comment.'}</p><span className="status blue">Published</span>{shipment.review.dispute_status==='PENDING'?<p className="permission-note warning">Dispute pending. The rating stays visible and counted during review.</p>:shipment.review.rating<=3?<form action={`/api/provider-reviews/${shipment.review.id}/dispute`} method="post" className="stack"><input type="hidden" name="shipmentId" value={shipment.id}/><div className="form-group"><label htmlFor="review-dispute">Dispute this review</label><textarea id="review-dispute" name="reason" minLength={5} maxLength={1000} required/></div><button className="button secondary"><ShieldAlert aria-hidden="true"/>Submit dispute</button></form>:null}</section>:null}</aside>
    </div>
  </div>;
}
