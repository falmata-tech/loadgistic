
import {Text,Localized} from '@/components/localization';
import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {publicPageMetadata} from '@/lib/seo.js';
import {PublicHeader} from '@/components/public-header';
import {PublicCapacityFeed} from '@/components/public-capacity-feed';
import {listPublicCapacityCursor} from '@/lib/capacity-market.js';
import {capacityIntroduction} from '@/lib/platform-copy.js';
import {CAPACITY_FILTER_CHOICES,capacityFilterRecord,type CapacityFilterGroups} from '@/lib/capacity-filter-values.js';
import {getCurrentUser} from '@/lib/auth';
import {listBusinessCapacity} from '@/lib/business-capacity/supabase';

export const dynamic='force-dynamic';
export async function generateMetadata({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}):Promise<Metadata>{
  const query=await searchParams;
  const privateView=Array.isArray(query.view)?query.view.includes('private'):query.view==='private';
  return publicPageMetadata({path:'/',title:{absolute:'Vehicle Capacity & Transporter Networks | Loadgistic'},description:'Keep your transporters in view. Find vehicle space and routes, explore public availability, or open capacity shared privately with you.',query,privateView});
}

export default async function HomePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {loadType:_legacySpaceNeeded,...input}=await searchParams;
  const raw=Object.fromEntries(Object.entries(input).map(([key,value])=>[key,Array.isArray(value)?value[0]:value])) as Record<string,string|undefined>;
  const privateView=raw.view==='private';
  const user=await getCurrentUser({allowLimited:true});
  const canViewShared=!user||user.role==='CUSTOMER'&&Boolean(user.selected_business_workspace?.permissions.capacity);
  if(privateView&&user&&user.role!=='CUSTOMER')redirect('/');
  let selections:CapacityFilterGroups;let filterError:string|undefined;
  try{selections=capacityFilterRecord(input);}catch{
    filterError='Check your search and vehicle filters.';
    selections=Object.fromEntries(Object.keys(CAPACITY_FILTER_CHOICES).map(key=>[key,Array.isArray(input[key])?'INVALID_CAPACITY_FILTER':raw[key]||''])) as CapacityFilterGroups;
    if(Object.values(input).some(Array.isArray)&&!Object.keys(CAPACITY_FILTER_CHOICES).some(key=>Array.isArray(input[key])))selections.status='INVALID_CAPACITY_FILTER';
  }
  const query={ownerDocs:raw.ownerDocs||'',driverDocs:raw.driverDocs||'',truckDocs:raw.truckDocs||'',q:raw.q||'',provider:raw.provider||'',truck:raw.truck||'',status:raw.status||'',vehicleCategory:raw.vehicleCategory||'',stopOption:raw.stopOption||'',freshness:raw.freshness||'',locationSource:raw.locationSource||'',truckCityPlaceRef:raw.truckCityPlaceRef||'',truckCity:raw.truckCity||'',truckLocationRadiusKm:raw.truckLocationRadiusKm||'',originPlaceRef:raw.originPlaceRef||'',origin:raw.origin||'',originRadiusKm:raw.originRadiusKm||'',destinationPlaceRef:raw.destinationPlaceRef||'',destination:raw.destination||'',destinationRadiusKm:raw.destinationRadiusKm||'',directionMode:raw.directionMode||'',nearLat:raw.nearLat||'',nearLng:raw.nearLng||'',nearRadiusKm:raw.nearRadiusKm||''};
  const {loadType:_retiredSelection,...visibleSelections}=selections;
  Object.assign(query,visibleSelections);
  const mapQuery={...query,q:'',...(privateView?{view:'private'}:{})};
  const denied={items:[],hasMore:false,nextCursor:null,pageSize:14,filterError};
  let apiPath='/api/public/capacity',searchApiPath: string|undefined,scope='public';
  let initial;
  if(privateView){
    if(!user)redirect('/login?from=shared-capacity');
    if(!user.active)redirect('/signup?verified=1');
    if(user.role==='CUSTOMER'){
      const workspace=user.selected_business_workspace;
      if(!workspace?.permissions.capacity)redirect('/app/business/account');
      scope=`${user.id}:${workspace.id}:${workspace.membershipRevision}`;
      apiPath=`/api/business-workspaces/${workspace.id}/capacity`;
      searchApiPath=`${apiPath}/search`;
      initial=filterError?{...denied,pageSize:100}:await listBusinessCapacity(user.id,workspace.id,mapQuery);
    }else redirect('/');
  }else initial=filterError?denied:await listPublicCapacityCursor(mapQuery,{pageSize:14});
  return <><PublicHeader user={user}/><main className="public-app-page public-market-workspace public-market-introduced unified-capacity-workspace">
    <header className="market-introduction">
      <h1><Text message={capacityIntroduction.title}/></h1>
      <p><Text message={capacityIntroduction.body}/></p>
      {canViewShared?<Localized as="nav" copy={["aria-label"]} className="capacity-view-choice" aria-label="Capacity views">
        <a href="/" aria-current={!privateView?'page':undefined}><Text message="Open to the public"/></a>
        <a href="/?view=private" aria-current={privateView?'page':undefined}><Text message="Shared with you"/></a>
      </Localized>:null}
    </header>
    <div className="capacity-view-body">
      <Localized as="section" copy={["aria-label"]} id="capacity-market" className="container home-market-shell public-market-console" aria-label="Open transport capacity"><div className="public-capacity-body"><PublicCapacityFeed key={scope} initial={initial} query={mapQuery} apiPath={apiPath} searchApiPath={searchApiPath}/></div></Localized>
    </div>
  </main></>;
}
