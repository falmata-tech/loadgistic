import { KeyRound, PackageSearch } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { Flash } from '@/components/flash';

export default async function TrackingUnlockPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const query=await searchParams;
  return <><PublicHeader/><main className="section"><div className="container tracking-unlock-shell">
    <Flash error={query.error} success={query.success}/>
    <section className="tracking-unlock-panel">
      <div className="tracking-unlock-icon"><KeyRound aria-hidden="true"/></div>
      <div>
        <h1 className="page-title">Open customer tracking</h1>
        <p className="page-subtitle">Enter the private code given to you by the transport provider.</p>
      </div>
      <form action="/api/tracking/unlock" method="post" className="tracking-code-form">
        <div className="form-group"><label htmlFor="tracking-code"><KeyRound aria-hidden="true"/>Secret shipment code</label><input id="tracking-code" name="trackingCode" autoComplete="off" inputMode="text" placeholder="LG-XXXX-XXXX" required/></div>
        <button className="button icon-button-label"><PackageSearch aria-hidden="true"/>Open tracking</button>
      </form>
      <p className="meta">No account is required. Shippers and receivers receive separate codes, and the page locks after five minutes without activity.</p>
    </section>
  </div></main></>;
}
