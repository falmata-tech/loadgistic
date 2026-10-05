
import {Text,Localized} from '@/components/localization';
import type {Metadata} from 'next';
import {Flash} from '@/components/flash';
import {getSharedCapacitySession} from '@/lib/auth';
import {listSharedCapacity} from '@/lib/private-capacity.js';
import {SharedCapacitySessionBoundary} from '@/components/shared-capacity-session-boundary';
import {LockedCapacityMap} from '@/components/locked-capacity-map';
import {localAuthInboxUrl} from '@/lib/auth-flow.js';
import {PublicHeader} from '@/components/public-header';
import {PublicCapacityFeed} from '@/components/public-capacity-feed';
import {listPublicCapacityCursor} from '@/lib/capacity-market.js';

export const dynamic='force-dynamic';
const publicMetadata:Metadata={title:{absolute:'Truck Capacity & Shipment Tracking in Ethiopia | Loadgistic'},description:'Find truck capacity in Ethiopia. Connect with transport providers, share available truck space with your network or the open market, and track shipments privately.'};

export async function generateMetadata({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}):Promise<Metadata>{
  const query=await searchParams;
  return query.view==='private'?{...publicMetadata,robots:{index:false,follow:false}}:publicMetadata;
}

export default async function HomePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const raw=await searchParams;
  const query={ownerDocs:raw.ownerDocs||'',driverDocs:raw.driverDocs||'',truckDocs:raw.truckDocs||'',q:raw.q||'',provider:raw.provider||'',truck:raw.truck||'',status:raw.status||'',vehicleCategory:raw.vehicleCategory||'',loadType:raw.loadType||'',stopOption:raw.stopOption||'',freshness:raw.freshness||'',truckCityPlaceRef:raw.truckCityPlaceRef||'',truckCity:raw.truckCity||'',truckLocationRadiusKm:raw.truckLocationRadiusKm||'',originPlaceRef:raw.originPlaceRef||'',origin:raw.origin||'',originRadiusKm:raw.originRadiusKm||'',destinationPlaceRef:raw.destinationPlaceRef||'',destination:raw.destination||'',destinationRadiusKm:raw.destinationRadiusKm||'',directionMode:raw.directionMode||'',nearLat:raw.nearLat||'',nearLng:raw.nearLng||'',nearRadiusKm:raw.nearRadiusKm||''};
  const privateView=raw.view==='private';
  const session=privateView?await getSharedCapacitySession():null;
  const initial=privateView?(session?await listSharedCapacity(session.emailDigest,query):null):await listPublicCapacityCursor(query,{pageSize:14});
  const sessionError=raw.session==='inactive'?'Your Private capacity session ended after 30 minutes without activity. Verify your email to continue.':undefined;
  const sessionSuccess=raw.session==='logout'?'You have logged out of Private capacity.':undefined;
  return <><PublicHeader/><main className={`public-app-page public-market-workspace public-market-introduced unified-capacity-workspace${privateView?' is-private':''}`}>
    <header className="market-introduction">
      <h1><Text message="Find truck capacity in Ethiopia"/></h1>
      <p><Text message="Transporters share capacity, routes and availability with brokers, shippers and receivers on Loadgistic. Explore open signals or view those shared with your email."/></p>
      <Localized as="nav" copy={["aria-label"]} className="capacity-view-choice" aria-label="Capacity views">
        <a href="/" aria-current={!privateView?'page':undefined}><Text message="Open to the public"/></a>
        <a href="/?view=private" aria-current={privateView?'page':undefined}><Text message="Privately shared with you"/></a>
      </Localized>
    </header>
    <div className="capacity-view-body" key={privateView?'private':'open'}>
      {privateView?<Flash error={sessionError||raw.error} success={sessionSuccess||raw.success}/>:null}
      {privateView&&!session?<LockedCapacityMap localInbox={localAuthInboxUrl()}/>:privateView&&session?
        <SharedCapacitySessionBoundary initialExpiresAt={session.expiresAt}><Localized as="section" copy={["aria-label"]} className="container home-market-shell public-market-console" aria-label="Privately shared truck capacity"><PublicCapacityFeed initial={initial!} query={query} searchPath="/shared-capacity" apiPath="/api/shared-capacity"/></Localized></SharedCapacitySessionBoundary>
        :<Localized as="section" copy={["aria-label"]} id="capacity-market" className="container home-market-shell public-market-console" aria-label="Open transport capacity"><div className="public-capacity-body"><PublicCapacityFeed initial={initial!} query={query}/></div></Localized>}
    </div>
  </main></>;
}
