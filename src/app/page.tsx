import type {Metadata} from 'next';
import {PublicHeader} from '@/components/public-header';
import {PublicCapacityFeed} from '@/components/public-capacity-feed';
import {listPublicCapacityCursor} from '@/lib/capacity-market.js';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Open Transport Capacity',description:'Find transport capacity by route, service area, truck configuration, and load type across Ethiopia.'};

export default async function HomePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const raw=await searchParams;
  const query={q:raw.q||'',provider:raw.provider||'',truck:raw.truck||'',status:raw.status||'',geometry:raw.geometry||'',vehicleCategory:raw.vehicleCategory||'',loadType:raw.loadType||'',stopOption:raw.stopOption||'',freshness:raw.freshness||'',currentAreaPlaceRef:raw.currentAreaPlaceRef||'',currentArea:raw.currentArea||'',currentAreaRadiusKm:raw.currentAreaRadiusKm||'',originPlaceRef:raw.originPlaceRef||'',origin:raw.origin||'',originRadiusKm:raw.originRadiusKm||'',destinationPlaceRef:raw.destinationPlaceRef||'',destination:raw.destination||'',destinationRadiusKm:raw.destinationRadiusKm||'',directionMode:raw.directionMode||'',nearLat:raw.nearLat||'',nearLng:raw.nearLng||'',nearRadiusKm:raw.nearRadiusKm||''};
  const initial=await listPublicCapacityCursor(query,{pageSize:14});
  return <><PublicHeader/><main className="public-app-page public-market-workspace">
    <h1 className="sr-only">Open Transport Capacity</h1>
    <section id="capacity-market" className="container home-market-shell public-market-console" aria-label="Open transport capacity"><div className="public-capacity-body"><PublicCapacityFeed key={Object.values(query).join('|')} initial={initial} query={query}/></div></section>
  </main></>;
}
