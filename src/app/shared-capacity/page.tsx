import type {Metadata} from 'next';
import {Network} from 'lucide-react';
import {PublicHeader} from '@/components/public-header';
import {PublicCapacityFeed} from '@/components/public-capacity-feed';
import {Flash} from '@/components/flash';
import {getSharedCapacitySession} from '@/lib/auth';
import {listSharedCapacity} from '@/lib/private-capacity.js';
import {SharedCapacityAccessForm} from '@/components/shared-capacity-access-form';
import {SharedCapacitySessionBoundary} from '@/components/shared-capacity-session-boundary';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Shared capacity',description:'View truck capacity privately shared with your verified email.'};

export default async function SharedCapacityPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const query=await searchParams;
  const session=await getSharedCapacitySession();
  const sessionError=query.session==='inactive'?'Your Shared capacity session ended after 30 minutes without activity. Verify your email to continue.':undefined;
  const sessionSuccess=query.session==='logout'?'You have logged out of Shared capacity.':undefined;
  const filters={q:query.q||'',provider:query.provider||'',truck:query.truck||'',status:query.status||'',geometry:query.geometry||'',vehicleCategory:query.vehicleCategory||'',loadType:query.loadType||'',stopOption:query.stopOption||'',freshness:query.freshness||'',currentAreaPlaceRef:query.currentAreaPlaceRef||'',currentArea:query.currentArea||'',currentAreaRadiusKm:query.currentAreaRadiusKm||'',originPlaceRef:query.originPlaceRef||'',origin:query.origin||'',originRadiusKm:query.originRadiusKm||'',destinationPlaceRef:query.destinationPlaceRef||'',destination:query.destination||'',destinationRadiusKm:query.destinationRadiusKm||'',directionMode:query.directionMode||'',nearLat:query.nearLat||'',nearLng:query.nearLng||'',nearRadiusKm:query.nearRadiusKm||''};
  return <><PublicHeader/><main className={`public-app-page ${session?'public-market-workspace':'public-information-workspace'}`}>
    <header className="public-workspace-heading container"><div><span className="section-kicker"><Network aria-hidden="true"/>Shared capacity</span><h1>Private capacity shared with you.</h1><p>Verify your email to see current availability and the approximate location each transporter chose to share with trusted contacts.</p></div></header>
    <Flash error={sessionError||query.error} success={sessionSuccess||query.success}/>
    {session?<SharedCapacitySessionBoundary initialExpiresAt={session.expiresAt}><section className="container home-market-shell public-market-console" aria-label="Privately shared truck capacity"><PublicCapacityFeed initial={await listSharedCapacity(session.emailDigest,filters)} query={filters} searchPath="/shared-capacity" apiPath="/api/shared-capacity"/></section></SharedCapacitySessionBoundary>
      :<section className="container shared-capacity-access"><SharedCapacityAccessForm/></section>}
  </main></>;
}
