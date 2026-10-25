import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,CalendarClock} from 'lucide-react';
import {Text} from '@/components/localization';
import {StatusPill} from '@/components/status-pill';
import {PageHeader} from '@/components/page-header';
import {TrackingLocationMap} from '@/components/tracking-location-map';
import {TrackingSharing} from '@/components/tracking-sharing';
import {TrackingProofLink} from '@/components/tracking-proof-link';
import {BusinessTrackingOwnerActions} from '@/components/business-tracking-owner-actions';
import {DemoTrackingLabel} from '@/components/demo-tracking-label';
import {isDemoTrackingShipment} from '@/lib/demo-tracking-identity.js';
import {trackingMapData} from '@/components/tracking-map-data';
import {displayStatus} from '@/lib/ui';
import {requireBusinessWorkspace} from '@/lib/identity/require-business';
import {TrackingSharingError} from '@/lib/tracking-sharing/domain';
import {getBusinessTrackingDetail} from '@/lib/tracking-sharing/server';
import {accountOwnerVerification} from '@/lib/tracking-sharing/account-owner';
import {getProviderGuestTracking} from '@/lib/provider-tracking.js';
import styles from '@/components/tracking-record.module.css';
export const dynamic='force-dynamic';
const text=(value:unknown)=>typeof value==='string'?value:'';
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
export default async function BusinessTrackingDetailPage({params}:{params:Promise<{id:string}>}){
 const {user,workspace}=await requireBusinessWorkspace('tracking'),{id}=await params;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))notFound();
 let detail:Awaited<ReturnType<typeof getBusinessTrackingDetail>>;
 try{detail=await getBusinessTrackingDetail(user.id,workspace.id,id);}
 catch(error){if(error instanceof TrackingSharingError&&['NOT_FOUND','TRACKING_ACCESS_DENIED','BUSINESS_FORBIDDEN'].includes(error.code))notFound();throw error;}
 if(!detail)notFound();
 const shipment=record(detail.shipment),map=trackingMapData(shipment),demo=isDemoTrackingShipment(id);
 const owner=detail.isOwner?record(await getProviderGuestTracking(id,accountOwnerVerification(user.email||'',true).digest)):null;
 if(detail.isOwner&&owner?.recipient_role!=='OWNER')notFound();
 const events=Array.isArray(owner?.events)?owner.events.map(record):Array.isArray(shipment.events)?shipment.events.map(record):[];
 return <div className={`page tracking-detail-page ${styles.page}`}><PageHeader icon={CalendarClock} title={text(shipment.code)} subtitle={workspace.name} action={<Link className="button secondary" href="/app/business/tracking"><ArrowLeft aria-hidden="true"/><Text message="Tracking"/></Link>}/>
  {demo?<DemoTrackingLabel/>:null}
  <TrackingLocationMap shipment={map}/>
  <section className={`provider-shipment-summary ${styles.summary}`}><header className={styles.summaryHeader}><div><small><Text message="Cargo"/></small><h2>{text(shipment.cargo_summary)}</h2></div><StatusPill status={text(shipment.operational_status)}/></header>
   {detail.isOwner?<div className="button-row"><TrackingSharing shipmentId={id} endpoint={`/api/business-workspaces/${workspace.id}/tracking/${id}/sharing`}/></div>:null}
  </section>
  <section className={styles.section}><header><h2><CalendarClock aria-hidden="true"/><Text message="Status timeline"/></h2></header><ol className={styles.timeline}>{events.map(event=><li key={text(event.id)}><div><strong><Text message={displayStatus(text(event.status))}/></strong>{demo?<DemoTrackingLabel kind="event"/>:null}{text(event.note)?<p>{text(event.note)}</p>:null}{event.has_proof===true&&owner?<TrackingProofLink shipmentId={id} eventId={text(event.id)} endpoint={`/api/business-workspaces/${workspace.id}/tracking/${id}/proof/${text(event.id)}`}/>:null}<time dateTime={text(event.created_at)}>{new Date(text(event.created_at)).toLocaleString()}</time></div></li>)}</ol></section>
  {owner?<BusinessTrackingOwnerActions endpoint={`/api/business-workspaces/${workspace.id}/tracking/${id}/actions`} canApprove={owner.can_approve===true} canReview={owner.can_review===true} review={typeof record(owner.review).rating==='number'?{rating:Number(record(owner.review).rating),note:text(record(owner.review).note)}:null}/>:null}
 </div>;
}
