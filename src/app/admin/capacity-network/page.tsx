import {Network} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {listLoadgisticSharedCapacity} from '@/lib/repository.js';
import {PageHeader} from '@/components/page-header';
import {PublicCapacityFeed} from '@/components/public-capacity-feed';

export const dynamic='force-dynamic';

export default async function AdminCapacityNetworkPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['ADMIN','SUPPORT'],{allowLimited:true});
  const raw=await searchParams;
  const query={q:raw.q||'',provider:raw.provider||'',truck:raw.truck||'',status:raw.status||'',geometry:raw.geometry||'',vehicleCategory:raw.vehicleCategory||'',loadType:raw.loadType||'',stopOption:raw.stopOption||'',freshness:raw.freshness||'',currentAreaPlaceRef:raw.currentAreaPlaceRef||'',currentArea:raw.currentArea||'',currentAreaRadiusKm:raw.currentAreaRadiusKm||'',originPlaceRef:raw.originPlaceRef||'',origin:raw.origin||'',originRadiusKm:raw.originRadiusKm||'',destinationPlaceRef:raw.destinationPlaceRef||'',destination:raw.destination||'',destinationRadiusKm:raw.destinationRadiusKm||'',directionMode:raw.directionMode||'',nearLat:raw.nearLat||'',nearLng:raw.nearLng||'',nearRadiusKm:raw.nearRadiusKm||''};
  return <div className="page admin-capacity-network"><PageHeader icon={Network} title="Private capacity network" subtitle="Trucks that explicitly shared current availability with Loadgistic for Assisted matching."/><section className="home-market-shell public-market-console"><PublicCapacityFeed initial={await listLoadgisticSharedCapacity(user,query)} query={query} searchPath="/admin/capacity-network" apiPath="/api/admin/capacity-network"/></section></div>;
}
