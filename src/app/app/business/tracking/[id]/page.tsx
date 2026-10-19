import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,CalendarClock,ShieldCheck} from 'lucide-react';
import {Text} from '@/components/localization';
import {StatusPill} from '@/components/status-pill';
import {PageHeader} from '@/components/page-header';
import {TrackingLocationMap} from '@/components/tracking-location-map';
import {trackingMapData} from '@/components/tracking-map-data';
import {displayStatus} from '@/lib/ui';
import {requireBusinessWorkspace} from '@/lib/identity/require-business';
import {TrackingSharingError} from '@/lib/tracking-sharing/domain';
import {getBusinessTrackingDetail} from '@/lib/tracking-sharing/server';
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
 const shipment=record(detail.shipment),map=trackingMapData(shipment),events=Array.isArray(shipment.events)?shipment.events.map(record):[];
 return <div className={`page tracking-detail-page ${styles.page}`}><PageHeader icon={CalendarClock} title={text(shipment.code)} subtitle={workspace.name} action={<Link className="button secondary" href="/app/business/tracking"><ArrowLeft aria-hidden="true"/><Text message="Tracking"/></Link>}/>
  <TrackingLocationMap shipment={map}/>
  <section className={`provider-shipment-summary ${styles.summary}`}><header className={styles.summaryHeader}><div><small><Text message="Cargo"/></small><h2>{text(shipment.cargo_summary)}</h2></div><StatusPill status={text(shipment.operational_status)}/></header>
   {detail.isOwner?<div className="button-row"><Link className="button secondary" href="/track"><ShieldCheck aria-hidden="true"/><Text message="Manage sharing and approval"/></Link><small className="meta"><Text message="Verify your shipment-owner email to continue."/></small></div>:null}
  </section>
  <section className={styles.section}><header><h2><CalendarClock aria-hidden="true"/><Text message="Status timeline"/></h2></header><ol className={styles.timeline}>{events.map(event=><li key={text(event.id)}><div><strong><Text message={displayStatus(text(event.status))}/></strong>{text(event.note)?<p>{text(event.note)}</p>:null}<time dateTime={text(event.created_at)}>{new Date(text(event.created_at)).toLocaleString()}</time></div></li>)}</ol></section>
 </div>;
}
