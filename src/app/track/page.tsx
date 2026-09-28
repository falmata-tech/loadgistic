import Link from 'next/link';
import {getTrackingEmailSession} from '@/lib/auth';
import {listTrackingEmailShipments} from '@/lib/provider-tracking.js';
import {TrackingSessionBoundary} from '@/components/tracking-idle-guard';
import {StatusPill} from '@/components/status-pill';

import {Text} from '@/components/localization';
import { KeyRound } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { Flash } from '@/components/flash';
import { TrackingUnlockForm } from '@/components/tracking-unlock-form';
import {localAuthInboxUrl} from '@/lib/auth-flow.js';

export default async function TrackingUnlockPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const query=await searchParams;
  const session=await getTrackingEmailSession();
  if(session){
    const page=Math.max(1,Math.min(5001,Number.parseInt(query.page||'1',10)||1));
    const shared=await listTrackingEmailShipments(session.recipientDigest,(page-1)*20);
    return <><PublicHeader/><main className="public-app-page"><TrackingSessionBoundary initialExpiresAt={session.expiresAt}>
      <section className="container stack" style={{paddingBlock:24}}><Flash error={query.error}/><h1 className="page-title"><Text message="Your shipments"/></h1>
      {shared.total?shared.items.map(shipment=><Link className="card" href={`/track/${shipment.id}`} key={shipment.id}>
        <strong>{shipment.code}</strong><p>{shipment.origin} → {shipment.destination}</p><StatusPill status={shipment.operational_status}/>
      </Link>):<p><Text message="No shipments are currently shared with this email."/></p>}
      <nav className="actions" aria-label="Pagination">{page>1?<Link className="button secondary" href={`/track?page=${page-1}`}><Text message="Previous"/></Link>:null}{page*20<shared.total?<Link className="button secondary" href={`/track?page=${page+1}`}><Text message="Next"/></Link>:null}</nav>
      </section></TrackingSessionBoundary></main></>;
  }
  return <><PublicHeader/><main className="public-app-page public-form-workspace"><div className="container tracking-unlock-shell public-form-container">
    <section className="tracking-unlock-panel">
      <div className="tracking-unlock-icon"><KeyRound aria-hidden="true"/></div>
      <div>
        <h1 className="page-title"><Text message="Follow your shipment"/></h1>
        <p className="page-subtitle"><Text message="Enter the email your transporter added. We’ll send one code to open your shipments."/></p>
      </div>
      <Flash error={query.session==='inactive'?'Your tracking session expired. Verify your email to continue.':query.error} success={query.session==='logout'?'You are logged out.':query.success}/>
      <TrackingUnlockForm localInbox={localAuthInboxUrl()}/>
      <p className="meta"><Text message="No account required. A one-time email code protects private updates."/></p>
    </section>
  </div></main></>;
}
