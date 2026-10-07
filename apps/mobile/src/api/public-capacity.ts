import { discoveryParams, type TruckFilters } from './discovery.ts';
export type SignalPoint = {latitude:number;longitude:number;label:string};
export type RegularSignal = {geometry:'ROUTE'|'RADIUS';points:SignalPoint[]};
export type CapacitySignal = {
  id: string; provider: string; handle: string; driver: string;
  truck: string; status: 'EMPTY' | 'PARTIAL';
  latitude: number | null; longitude: number | null;
  capacityAge: string; locationAge: string; configuration:string;
  geometry:'ROUTE'|'RADIUS'|null; currentVisible:boolean; currentPoints:SignalPoint[];
  precisionKm:number; regular:RegularSignal[];
};
export type CapacityPage = { items: CapacitySignal[]; nextCursor: string | null; hasMore: boolean };
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid capacity response');
  return value as Record<string, unknown>;
};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const coordinate = (value: unknown, max: number): number | null =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max ? value : null;

const points = (value:unknown):SignalPoint[] => {
 if(!Array.isArray(value))return[];
 const result:SignalPoint[]=[];
 for(const raw of value){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return[];
  const row=raw as Record<string,unknown>,latitude=coordinate(row.lat,90),longitude=coordinate(row.lng,180);
  // Removing a bad vertex would invent a different route/boundary.
  if(latitude===null||longitude===null)return[];
  result.push({latitude,longitude,label:text(row.label)});
 }
 return result;
};
// Explicit projection prevents accidental persistence of contacts or extra server fields.
export function parseCapacityPage(value: unknown): CapacityPage {
  const page = record(value);
  if (page.filterError) throw new Error('Choose valid cities and try your filters again.');
  if (!Array.isArray(page.items) || typeof page.hasMore !== 'boolean') throw new Error('Invalid capacity response');
  const items: CapacitySignal[] = [];
  for (const raw of page.items) {
    const row = record(raw);
    if (row.status !== 'EMPTY' && row.status !== 'PARTIAL') continue;
    const id = text(row.id), driver = text(row.assigned_driver_first_name);
    if (!id || !driver) continue;
    items.push({ id, driver, provider: text(row.provider_name), handle: text(row.provider_handle),
      truck: [text(row.vehicle_make), text(row.vehicle_model)].filter(Boolean).join(' '),
      status: row.status, latitude: coordinate(row.location_lat, 90), longitude: coordinate(row.location_lng, 180),
      capacityAge: text(row.capacity_updated_label), locationAge: text(row.location_updated_label),
      configuration:text(row.cargo_configuration),geometry:row.availability_geometry==='ROUTE'?'ROUTE':row.availability_geometry==='RADIUS'?'RADIUS':null,
      currentVisible:row.current_signal_geometry_visible!==false,
      currentPoints:points(row.availability_geometry==='ROUTE'?row.current_route_points:row.capacity_area_boundary),
      precisionKm:typeof row.location_precision_km==='number'&&Number.isFinite(row.location_precision_km)&&row.location_precision_km>0?row.location_precision_km:20,
      regular:Array.isArray(row.recurring_corridors)?row.recurring_corridors.slice(0,1).flatMap(raw=>{
       if(!raw||typeof raw!=='object')return[];const recurring=raw as Record<string,unknown>;
       if(recurring.geometry!=='ROUTE'&&recurring.geometry!=='RADIUS')return[];
       return [{geometry:recurring.geometry as 'ROUTE'|'RADIUS',points:points(recurring.geometry==='ROUTE'?recurring.route_points:recurring.area_boundary)}];
      }):[], });
  }
  const nextCursor = text(page.nextCursor) || null;
  if (page.hasMore && !nextCursor) throw new Error('Incomplete capacity pagination');
  return { items, hasMore: page.hasMore, nextCursor };
}

export function capacityUrl(baseUrl: string, query: string, cursor = '', filters:TruckFilters = {}): string {
  const base = new URL(baseUrl);
  if (base.username || base.password || base.search || base.hash) throw new Error('Invalid API URL');
  const octets = base.hostname.split('.').map(Number);
  const ipv4 = octets.length === 4 && octets.every(part => Number.isInteger(part) && part >= 0 && part <= 255);
  const local = base.hostname === 'localhost' || base.hostname === '127.0.0.1' || (ipv4 && (octets[0] === 10 || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)));
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && local)) throw new Error('HTTPS is required');
  const url = new URL('/api/public/capacity', base);
  url.search = discoveryParams(query,filters).toString();
  if (cursor) url.searchParams.set('cursor', cursor);
  return url.toString();
}

export async function loadCapacity(baseUrl: string, query: string, signal: AbortSignal,
  onPage: (items: CapacitySignal[]) => void, request: typeof fetch = fetch, filters:TruckFilters = {}): Promise<void> {
  let cursor = ''; const seen = new Set<string>(); const items = new Map<string, CapacitySignal>();
  do {
    const response = await request(capacityUrl(baseUrl, query, cursor, filters), { signal, credentials: 'omit', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Capacity is temporarily unavailable. Please try again.');
    const page = parseCapacityPage(await response.json());
    if (signal.aborted) throw new Error('Request cancelled');
    for (const item of page.items) items.set(item.id, item);
    onPage([...items.values()]);
    if (!page.hasMore) return;
    cursor = page.nextCursor!;
    if (seen.has(cursor)) throw new Error('Capacity could not finish loading. Please try again.');
    seen.add(cursor);
  } while (!signal.aborted);
}

export async function loadSharedCapacity(query: string, signal: AbortSignal, onPage: (items: CapacitySignal[]) => void, request: (path: string, signal: AbortSignal) => Promise<unknown>, filters:TruckFilters = {}): Promise<void> {
 let cursor = ''; const seen = new Set<string>(), items = new Map<string, CapacitySignal>();
 do {
  const params = discoveryParams(query,filters); if(cursor)params.set('cursor',cursor);
  const page = parseCapacityPage(await request(`/api/mobile/visitor/capacity/signals?${params}`, signal));
  if (signal.aborted) throw new Error('Request cancelled');
  for (const item of page.items) items.set(item.id, item);
  onPage([...items.values()]);
  if (!page.hasMore) return;
  cursor = page.nextCursor!;
  if (seen.has(cursor)) throw new Error('Capacity could not finish loading. Please try again.');
  seen.add(cursor);
 } while (!signal.aborted);
}
