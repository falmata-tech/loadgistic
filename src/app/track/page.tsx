import Link from 'next/link';
import { KeyRound, PackageSearch } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { PublicHeader } from '@/components/public-header';
import { Flash } from '@/components/flash';

export default async function TrackingUnlockPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await getCurrentUser();
  const query=await searchParams;
  const isProvider=Boolean(user&&['TRANSPORTER','DRIVER','ADMIN'].includes(user.role));
  return <><PublicHeader/><main className="section"><div className="container tracking-unlock-shell">
    <Flash error={query.error} success={query.success}/>
    <section className="tracking-unlock-panel">
      <div className="tracking-unlock-icon"><KeyRound aria-hidden="true"/></div>
      <div>
        <h1 className="page-title">Open customer tracking</h1>
        <p className="page-subtitle">{isProvider?'Transport providers follow assigned shipments inside their Tracking workspace.':'Enter the secret code given to the shipper or receiver by the shipment owner.'}</p>
      </div>
      {!isProvider?<form action="/api/tracking/unlock" method="post" className="tracking-code-form">
        <div className="form-group"><label htmlFor="tracking-code"><KeyRound aria-hidden="true"/>Secret shipment code</label><input id="tracking-code" name="trackingCode" autoComplete="off" inputMode="text" placeholder="LG-XXXX-XXXX" required/></div>
        <button className="button icon-button-label"><PackageSearch aria-hidden="true"/>Open tracking</button>
      </form>:<Link className="button icon-button-label" href="/app/shipments"><PackageSearch aria-hidden="true"/>Open my Tracking</Link>}
      <p className="meta">The secret code works for account and non-account shipment parties and locks after five minutes without activity.</p>
    </section>
  </div></main></>;
}
