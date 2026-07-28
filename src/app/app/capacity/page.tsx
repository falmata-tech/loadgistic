import Link from 'next/link';
import Image from 'next/image';
import { requireUser } from '@/lib/auth';
import { listMarketCapacity, listOwnLoadRouteOptions } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { capacityLabel } from '@/lib/domain.js';
import { relativeTime } from '@/lib/ui';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { VEHICLE_CONFIGURATIONS } from '@/lib/vehicle-configurations';
import { Route, Search, SlidersHorizontal, X } from 'lucide-react';
import { EthiopiaPlaceInput } from '@/components/ethiopia-place-input';

function acceptedLoads(capacity:any) {
  if (capacity.accepts_full_load && capacity.accepts_partial_load) return 'FTL + PTL';
  if (capacity.accepts_partial_load) return 'PTL';
  return 'FTL';
}

function stopPolicy(capacity:any){
  const options=['Direct'];
  if(capacity.accepts_multi_pick)options.push('Multi Pick');
  if(capacity.accepts_multi_drop)options.push('Multi Drop');
  return options.join(' + ');
}

export default async function CapacityPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(); const query=await searchParams; const filters={q:query.q||'',origin:query.origin||'',destination:query.destination||'',status:query.status||'',loadType:query.loadType||'',vehicleCategory:query.vehicleCategory||'',matchLoadId:query.matchLoadId||''}; const rows:any[]=listMarketCapacity(user,filters); const isProvider=['TRANSPORTER','DRIVER'].includes(user.role); const loadRoutes:any[]=listOwnLoadRouteOptions(user); const hasFilters=Object.values(filters).some(Boolean);
 return <div className="page"><PageHeader title="Capacity Board" subtitle={isProvider?'A read-only view of current supply signals from other trucks.':'Every card is one fresh Empty or Partial truck available for freight work.'}/>
 {isProvider?<div className="alert">The Capacity Board is read only for transporters and drivers. Use it to understand supply; contact and interest actions are not available here.</div>:<div className="alert">Each truck stands on its own. Public means all logged-in businesses; Partners means only Connected network Businesses.</div>}
 <form className="board-filter-panel" method="get">
   <div className="board-filter-heading"><SlidersHorizontal aria-hidden="true"/><div><h2>Find the closest capacity</h2><p>Search directly or rank trucks against one of your load routes.</p></div></div>
   <div className="board-filter-grid">
     <div className="form-group filter-search"><label htmlFor="capacity-search"><Search aria-hidden="true"/>Search</label><input id="capacity-search" name="q" defaultValue={filters.q} placeholder="Truck, transporter, city, or area"/></div>
     {loadRoutes.length?<div className="form-group filter-match"><label htmlFor="capacity-match"><Route aria-hidden="true"/>Match a posted load</label><select id="capacity-match" name="matchLoadId" defaultValue={filters.matchLoadId}><option value="">Do not rank by a load</option>{loadRoutes.map(load=><option key={load.id} value={load.id}>{load.code} · {load.origin} → {load.destination}</option>)}</select></div>:null}
     <div className="form-group"><label htmlFor="capacity-origin">Corridor city 1</label><EthiopiaPlaceInput id="capacity-origin" name="origin" defaultValue={filters.origin} placeholder="Addis Ababa, Ethiopia"/></div>
     <div className="form-group"><label htmlFor="capacity-destination">Corridor city 2</label><EthiopiaPlaceInput id="capacity-destination" name="destination" defaultValue={filters.destination} placeholder="Hawassa, Ethiopia"/></div>
     <div className="form-group"><label htmlFor="capacity-status">Cargo space</label><select id="capacity-status" name="status" defaultValue={filters.status}><option value="">Empty or Partial</option><option value="EMPTY">Empty</option><option value="PARTIAL">Partial</option></select></div>
     <div className="form-group"><label htmlFor="capacity-load-type">Accepts</label><select id="capacity-load-type" name="loadType" defaultValue={filters.loadType}><option value="">FTL or PTL</option><option value="FTL">FTL</option><option value="PTL">PTL</option></select></div>
     <div className="form-group"><label htmlFor="capacity-truck-type">Cargo configuration</label><select id="capacity-truck-type" name="vehicleCategory" defaultValue={filters.vehicleCategory}><option value="">All truck types</option>{VEHICLE_CONFIGURATIONS.map(type=><option value={type.name} key={type.name}>{type.name}</option>)}</select></div>
   </div>
   <div className="board-filter-actions"><button className="button icon-button-label"><Search aria-hidden="true"/>Show matching trucks</button>{hasFilters?<Link href="/app/capacity" className="button secondary icon-button-label"><X aria-hidden="true"/>Clear</Link>:null}<span className="meta">{rows.length} {rows.length===1?'truck':'trucks'} shown</span></div>
 </form>
 <section className="capacity-market-grid">{rows.map((cap:any)=><article className="card capacity-market-card" key={cap.id}>
   <div className="market-card-top"><div className="market-truck-heading"><Image className="truck-thumbnail large" src={vehicleConfigurationImage(cap.cargo_configuration||cap.vehicle_category)} alt="" width={120} height={120}/><div><div className="status-row"><StatusPill status={cap.status}/><StatusPill status={cap.freshness}/>{cap.relationshipVisible?<span className="status green">Partners</span>:<span className="status">Public</span>}</div><h2>{cap.vehicle_make} · {cap.vehicle_model}</h2><div className="meta">{cap.cargo_configuration||cap.vehicle_category} · {cap.vehicle_label}<br/>{cap.organization_name||cap.provider_name}</div></div></div><strong className="market-capacity-value">{capacityLabel(cap.status,cap.available_percent)}</strong></div>
   <div className="progress"><span style={{width:`${cap.available_percent}%`}}/></div>
   <div className="market-signal-grid"><div><small>Current area</small><strong>{cap.location_area||cap.origin||'Area not updated'}</strong><span>{cap.location_source === 'DEVICE_OBSCURED' ? `Approximate device area · ${cap.location_precision_km} km privacy zone` : cap.location_updated_at?`Updated ${relativeTime(cap.location_updated_at)}`:'Location time unavailable'}</span></div><div><small>{cap.status==='PARTIAL'?'Current partial route':'Future planned travel'}</small><strong>{cap.status==='PARTIAL'?(cap.current_route_origin||'Origin open'):(cap.origin||'Origin open')} → {cap.status==='PARTIAL'?(cap.current_route_destination||'Destination open'):(cap.destination||'Destination open')}</strong><span>{cap.travel_date?`Planned ${cap.travel_date}`:'No future date recorded'}</span></div><div><small>Accepting</small><strong>{acceptedLoads(cap)}</strong><span>{stopPolicy(cap)} · {cap.open_to_contract_lanes?'Contract lanes':'Single-trip work'}</span></div><div><small>Proof signal</small><strong>{cap.proof_available?'Photo recorded':'No photo'}</strong><span>{cap.proof_recorded_at?relativeTime(cap.proof_recorded_at):'Not recorded'}</span></div></div>
   <div className="market-card-actions">{cap.route_match_label?<span className={`route-match match-${cap.route_match_score}`}><Route aria-hidden="true"/>{cap.route_match_label}</span>:null}<Link className="button secondary small" href={`/app/capacity/${cap.id}`}>View truck details</Link></div>
 </article>)}</section>{!rows.length?<div className="empty-state">No fresh capacity is visible right now.</div>:null}</div>;
}
