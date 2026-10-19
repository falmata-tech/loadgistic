
import {Text,Localized} from '@/components/localization';
import type {Metadata} from 'next';
import {publicPageMetadata} from '@/lib/seo.js';
import {Flash} from '@/components/flash';
import {getSharedCapacitySession} from '@/lib/auth';
import {listSharedCapacity} from '@/lib/private-capacity.js';
import {SharedCapacitySessionBoundary} from '@/components/shared-capacity-session-boundary';
import {LockedCapacityMap} from '@/components/locked-capacity-map';
import {localAuthInboxUrl} from '@/lib/auth-flow.js';
import {PublicHeader} from '@/components/public-header';
import {PublicCapacityFeed} from '@/components/public-capacity-feed';
import {listPublicCapacityCursor} from '@/lib/capacity-market.js';
import {capacityIntroduction} from '@/lib/platform-copy.js';
import {CAPACITY_FILTER_CHOICES,capacityFilterRecord,type CapacityFilterGroups} from '@/lib/capacity-filter-values.js';

export const dynamic='force-dynamic';
export async function generateMetadata({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}):Promise<Metadata>{
  const query=await searchParams;
  const privateView=Array.isArray(query.view)?query.view.includes('private'):query.view==='private';
  return publicPageMetadata({path:'/',title:{absolute:'Vehicle Capacity & Transporter Networks | Loadgistic'},description:'Keep your transporters in view. Find vehicle space and routes, explore public availability, or open capacity shared privately with you.',query,privateView});
}

export default async function HomePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {loadType:_legacySpaceNeeded,...input}=await searchParams;
  const raw=Object.fromEntries(Object.entries(input).map(([key,value])=>[key,Array.isArray(value)?value[0]:value])) as Record<string,string|undefined>;
  let selections:CapacityFilterGroups;let filterError:string|undefined;
  try{selections=capacityFilterRecord(input);}catch{
    filterError='Check your search and vehicle filters.';
    selections=Object.fromEntries(Object.keys(CAPACITY_FILTER_CHOICES).map(key=>[key,Array.isArray(input[key])?'INVALID_CAPACITY_FILTER':raw[key]||''])) as CapacityFilterGroups;
    if(Object.values(input).some(Array.isArray)&&!Object.keys(CAPACITY_FILTER_CHOICES).some(key=>Array.isArray(input[key])))selections.status='INVALID_CAPACITY_FILTER';
  }
  const query={ownerDocs:raw.ownerDocs||'',driverDocs:raw.driverDocs||'',truckDocs:raw.truckDocs||'',q:raw.q||'',provider:raw.provider||'',truck:raw.truck||'',status:raw.status||'',vehicleCategory:raw.vehicleCategory||'',stopOption:raw.stopOption||'',freshness:raw.freshness||'',locationSource:raw.locationSource||'',truckCityPlaceRef:raw.truckCityPlaceRef||'',truckCity:raw.truckCity||'',truckLocationRadiusKm:raw.truckLocationRadiusKm||'',originPlaceRef:raw.originPlaceRef||'',origin:raw.origin||'',originRadiusKm:raw.originRadiusKm||'',destinationPlaceRef:raw.destinationPlaceRef||'',destination:raw.destination||'',destinationRadiusKm:raw.destinationRadiusKm||'',directionMode:raw.directionMode||'',nearLat:raw.nearLat||'',nearLng:raw.nearLng||'',nearRadiusKm:raw.nearRadiusKm||''};
  const privateView=raw.view==='private';
  const session=privateView?await getSharedCapacitySession():null;
  const {loadType:_retiredSelection,...visibleSelections}=selections;
  Object.assign(query,visibleSelections);
  const mapQuery={...query,q:''};
  const denied={items:[],hasMore:false,nextCursor:null,pageSize:14,filterError};
  const initial=privateView?(session?(filterError?denied:await listSharedCapacity(session.emailDigest,mapQuery)):null):(filterError?denied:await listPublicCapacityCursor(mapQuery,{pageSize:14}));
  const sessionError=raw.session==='inactive'?'Your Private capacity session ended after 30 minutes without activity. Verify your email to continue.':undefined;
  const sessionSuccess=raw.session==='logout'?'You have logged out of Private capacity.':undefined;
  return <><PublicHeader/><main className={`public-app-page public-market-workspace public-market-introduced unified-capacity-workspace${privateView?' is-private':''}`}>
    <header className="market-introduction">
      <h1><Text message={capacityIntroduction.title}/></h1>
      <p><Text message={capacityIntroduction.body}/></p>
      <Localized as="nav" copy={["aria-label"]} className="capacity-view-choice" aria-label="Capacity views">
        <a href="/" aria-current={!privateView?'page':undefined}><Text message="Open to the public"/></a>
        <a href="/?view=private" aria-current={privateView?'page':undefined}><Text message="Privately shared with you"/></a>
      </Localized>
    </header>
    <div className="capacity-view-body" key={privateView?'private':'open'}>
      {privateView?<Flash error={sessionError||raw.error} success={sessionSuccess||raw.success}/>:null}
      {privateView&&!session?<LockedCapacityMap localInbox={localAuthInboxUrl()}/>:privateView&&session?
        <SharedCapacitySessionBoundary initialExpiresAt={session.expiresAt}><Localized as="section" copy={["aria-label"]} className="container home-market-shell public-market-console" aria-label="Privately shared vehicle capacity"><PublicCapacityFeed initial={initial!} query={query} searchPath="/shared-capacity" apiPath="/api/shared-capacity"/></Localized></SharedCapacitySessionBoundary>
        :<Localized as="section" copy={["aria-label"]} id="capacity-market" className="container home-market-shell public-market-console" aria-label="Open transport capacity"><div className="public-capacity-body"><PublicCapacityFeed initial={initial!} query={query}/></div></Localized>}
    </div>
  </main></>;
}
