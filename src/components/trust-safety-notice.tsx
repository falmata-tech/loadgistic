import { ShieldAlert } from 'lucide-react';

export function TrustSafetyNotice() {
  return <aside className="trust-safety-notice" aria-label="Document verification safety notice">
    <ShieldAlert aria-hidden="true"/>
    <div><strong>Verify before you agree.</strong><span>Badges show only the specific documents Loadgistic reviewed. Check badge details, expiry dates, original documents, identity, truck authority, cargo fit, and terms directly with the other party. An unverified or missing badge is a clear warning—not proof that a claim is true.</span></div>
  </aside>;
}
