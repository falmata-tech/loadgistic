import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {PublicHeader} from '@/components/public-header';
import {TrackingUnlockForm} from '@/components/tracking-unlock-form';
import {trackingLinkToken} from '@/lib/tracking-sessions/contracts';
import {parseTrackingLinkGrant,TRACKING_LINK_GRANT_COOKIE} from '@/lib/tracking-sessions/grant.js';
import {trackingSessionCredentialDigests} from '@/lib/security.js';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function TrackPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!trackingLinkToken.safeParse(id).success)notFound();
 const store=await cookies(),grant=parseTrackingLinkGrant(store.get(TRACKING_LINK_GRANT_COOKIE)?.value);
 const bound=grant&&grant.linkDigest===trackingSessionCredentialDigests(id,'00000000').linkDigest?grant:null;
 return <><PublicHeader/><TrackingUnlockForm linkToken={id} resumeSessionId={bound?.sessionId} resumeExpiresAt={bound?new Date(bound.expiresAt).toISOString():undefined}/></>;
}
