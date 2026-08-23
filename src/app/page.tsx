import type {Metadata} from 'next';
import {MapPinned} from 'lucide-react';
import {PublicHeader} from '@/components/public-header';
import {PublicCapacityFeed} from '@/components/public-capacity-feed';
import {listPublicCapacityCursor} from '@/lib/repository.js';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Truck Market',description:'Find public truck capacity for local, regional, long-distance, full-truck, and Partial-load freight across Ethiopia.'};

export default async function HomePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const raw=await searchParams;
  const query={q:raw.q||'',provider:raw.provider||'',truck:raw.truck||'',status:raw.status||'',geometry:raw.geometry||'',vehicleCategory:raw.vehicleCategory||'',loadType:raw.loadType||'',stopOption:raw.stopOption||'',freshness:raw.freshness||'',currentAreaPlaceRef:raw.currentAreaPlaceRef||'',currentArea:raw.currentArea||'',currentAreaRadiusKm:raw.currentAreaRadiusKm||'',originPlaceRef:raw.originPlaceRef||'',origin:raw.origin||'',originRadiusKm:raw.originRadiusKm||'',destinationPlaceRef:raw.destinationPlaceRef||'',destination:raw.destination||'',destinationRadiusKm:raw.destinationRadiusKm||'',directionMode:raw.directionMode||'',nearLat:raw.nearLat||'',nearLng:raw.nearLng||'',nearRadiusKm:raw.nearRadiusKm||''};
  const initial=await listPublicCapacityCursor(query,{pageSize:14});
  return <><PublicHeader/><main className="public-app-page public-market-workspace">
    <header className="public-workspace-heading container"><div><span className="section-kicker"><MapPinned aria-hidden="true"/>Truck Market</span><h1>Find capacity for local and long-distance freight.</h1><p>Search trucks for full loads or smaller Partial loads by transporter, location, Service area, or Capacity route. No account is required.</p></div></header>
    <section id="capacity-market" className="container home-market-shell public-market-console" aria-labelledby="capacity-market-title"><h2 className="sr-only" id="capacity-market-title">Available truck capacity</h2><div className="public-capacity-body"><PublicCapacityFeed key={Object.values(query).join('|')} initial={initial} query={query}/></div></section>
  </main></>;
}
