import { KeyRound } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { Flash } from '@/components/flash';
import { TrackingUnlockForm } from '@/components/tracking-unlock-form';
import {localAuthInboxUrl} from '@/lib/auth-flow.js';

export default async function TrackingUnlockPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const query=await searchParams;
  return <><PublicHeader/><main className="public-app-page public-form-workspace"><div className="container tracking-unlock-shell public-form-container">
    <section className="tracking-unlock-panel">
      <div className="tracking-unlock-icon"><KeyRound aria-hidden="true"/></div>
      <div>
        <h1 className="page-title">Track your shipment</h1>
        <p className="page-subtitle">Use the Tracking code and an email approved for this shipment.</p>
      </div>
      <Flash error={query.error} success={query.success}/>
      <TrackingUnlockForm localInbox={localAuthInboxUrl()}/>
      <p className="meta">No account is required. We verify your email before opening private shipment updates.</p>
    </section>
  </div></main></>;
}
