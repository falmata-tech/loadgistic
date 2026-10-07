import { discoveryFilters, discoveryProfiles } from './discovery-contract.js';
import { mobileJson, mobileFailure, MobileError } from './server';
import { requireVisitor } from './visitor-server';
import { searchCapacity } from '@/lib/capacity-search';
import { checkRateLimit } from '@/lib/rate-limit';
import { VEHICLE_CONFIGURATIONS } from '@/lib/vehicle-configurations';
export function readDiscoveryFilters(request: Request) {
 try {
  const filters = discoveryFilters(new URL(request.url).searchParams) as Record<string,string>;
  if (filters.vehicleCategory && !VEHICLE_CONFIGURATIONS.some(item=>item.name===filters.vehicleCategory)) throw new Error('INVALID');
  return filters;
 } catch { throw new MobileError(400,'INVALID_FILTER','Check your search and truck filters.'); }
}
export async function nativeDiscovery(request: Request, privateView: boolean) {
 try {
  // Only this route's verified grant chooses private authority. Query input cannot.
  const session = privateView ? requireVisitor(request,'capacity') : null;
  const filters = readDiscoveryFilters(request);
  const rate = await checkRateLimit(`mobile-discovery:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'}`,120,60000);
  if (!rate.allowed) throw new MobileError(429,'RATE_LIMIT','Please wait a moment.');
  const result = await searchCapacity(filters,session?{audience:'EMAIL',digest:session.digest}:{audience:'PUBLIC'});
  if (result.filterError) throw new MobileError(400,'INVALID_FILTER','Choose a city from the list and try again.');
  return mobileJson({...discoveryProfiles(result),configurations:VEHICLE_CONFIGURATIONS});
 } catch(error) { return mobileFailure(error); }
}
