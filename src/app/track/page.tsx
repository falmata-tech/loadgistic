import Link from 'next/link';
import { KeyRound, PackageSearch } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { PublicHeader } from '@/components/public-header';
import { Flash } from '@/components/flash';

export default async function TrackingUnlockPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser();
  const query=await searchParams;
  const isBusiness=['SHIPPER','RECEIVER'].includes(user.role);
  return <><PublicHeader/><main className="section"><div className="container tracking-unlock-shell">
    <Flash error={query.error} success={query.success}/>
    <section className="tracking-unlock-panel">
      <div className="tracking-unlock-icon"><KeyRound aria-hidden="true"/></div>
      <div>
        <h1 className="page-title">Open customer tracking</h1>
        <p className="page-subtitle">{isBusiness?'Enter the secret code for a load your Business is shipping or receiving.':'Transport providers follow assigned loads inside their Tracking workspace.'}</p>
      </div>
      {isBusiness?<form action="/api/tracking/unlock" method="post" className="tracking-code-form">
        <div className="form-group"><label htmlFor="tracking-code">Secret load code</label><input id="tracking-code" name="trackingCode" autoComplete="off" inputMode="text" placeholder="LG-XXXX-XXXX" required/></div>
        <button className="button icon-button-label"><PackageSearch aria-hidden="true"/>Open tracking</button>
      </form>:<Link className="button icon-button-label" href="/app/shipments"><PackageSearch aria-hidden="true"/>Open my Tracking</Link>}
      <p className="meta">Access is limited to the involved shipper and receiver Businesses and locks after five minutes without activity.</p>
    </section>
  </div></main></>;
}
