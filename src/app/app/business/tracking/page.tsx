import Link from 'next/link';
import {ArrowRight,ClipboardCheck,Package,Route} from 'lucide-react';
import {PageHeader} from '@/components/page-header';
import {StatusPill} from '@/components/status-pill';
import {Pagination} from '@/components/pagination';
import {Text} from '@/components/localization';
import {DemoTrackingLabel} from '@/components/demo-tracking-label';
import {isDemoTrackingShipment} from '@/lib/demo-tracking-identity.js';
import {requireBusinessWorkspace} from '@/lib/identity/require-business';
import {listBusinessTracking} from '@/lib/tracking-sharing/server';
import styles from '@/components/business-workspace.module.css';
export const dynamic='force-dynamic';
export default async function BusinessTrackingPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const {user,workspace}=await requireBusinessWorkspace('tracking'),query=await searchParams;
 const page=Math.max(1,Math.min(10000,Number(query.page)||1)),result=await listBusinessTracking(user.id,workspace.id,page);
 return <div className="page"><PageHeader icon={ClipboardCheck} title={<Text message="Tracking"/>} subtitle={workspace.name}/>
  {result.shipments.length?<section className={styles.accountCard}><div className="list">{result.shipments.map(shipment=><Link href={`/app/business/tracking/${encodeURIComponent(shipment.id)}`} className="list-row" key={shipment.id}><div><strong>{shipment.code}</strong>{isDemoTrackingShipment(shipment.id)?<DemoTrackingLabel/>:null}<p>{shipment.cargo}</p><div className={styles.scope}><Route aria-hidden="true"/><span>{shipment.origin} → {shipment.destination}</span></div><small className="meta"><Text message="Updated"/> {new Date(shipment.updatedAt).toLocaleString()}</small></div><StatusPill status={shipment.status}/><ArrowRight aria-hidden="true"/></Link>)}</div></section>:<section className={styles.empty}><Package aria-hidden="true"/><h2><Text message="No shipments shared yet"/></h2><p><Text message="When a shipment owner shares tracking with your workspace, it will appear here."/></p></section>}
  {result.pageCount>1?<Pagination path="/app/business/tracking" query={{}} page={result.page} pageCount={result.pageCount} total={result.total}/>:null}
 </div>;
}
