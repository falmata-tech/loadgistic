import { ShieldAlert } from 'lucide-react';

export function TrustSafetyNotice() {
  return <aside className="trust-safety-notice" aria-label="Document verification safety notice">
    <ShieldAlert aria-hidden="true"/>
    <div><strong>Review documents before agreement.</strong><span>A Loadgistic badge records the review of one document category; it is not a guarantee of identity, authority, payment, performance, or cargo safety. Confirm current originals, expiry dates, Driver and truck details, cargo compatibility, and commercial terms directly with the other party.</span></div>
  </aside>;
}
