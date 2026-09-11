import Image from 'next/image';
import { Boxes, CalendarClock, Camera, CircleDotDashed, Gauge, MapPin, Route, SlidersHorizontal, Truck } from 'lucide-react';
import { BoardFilterSheet } from '@/components/board-filter-sheet';
import { BoardGeographyFilters } from '@/components/board-geography-filters';
import { EthiopiaPlaceInput } from '@/components/ethiopia-place-input';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { StatusPill } from '@/components/status-pill';
import { capacityLabel } from '@/lib/domain.js';
import { relativeTime } from '@/lib/ui';
import { VEHICLE_CONFIGURATIONS, vehicleConfigurationImage } from '@/lib/vehicle-configurations';

type Filters=Record<string,string>;
type MarketTruck={
  status:string; cargo_configuration:string;
  movement_scope:string; local_place_label?:string|null; local_radius_km?:number|null; location_area?:string|null;
  location_updated_at?:string|null; current_route_origin?:string|null; current_route_destination?:string|null;
  origin?:string|null; destination?:string|null; travel_date?:string|null; planned_space_status?:string|null;
  accepts_full_load:number; accepts_partial_load:number; accepts_multi_pick:number; accepts_multi_drop:number;
  preferred_routes_label?:string|null; proof_available:boolean;
  proof_recorded_at?:string|null; freshness:string; updated_at:string;
};
type BoardResult={items:MarketTruck[];total:number;page:number;pageCount:number};

function acceptedLoads(truck:MarketTruck){
  if(truck.accepts_full_load&&truck.accepts_partial_load)return 'Full or partial truckload';
  if(truck.accepts_partial_load)return 'Partial Truckload (PTL)';
  return 'Full Truckload (FTL)';
}

function stopPolicy(truck:MarketTruck){
  const options=[];
  if(truck.accepts_multi_pick)options.push('Multi Pick');
  if(truck.accepts_multi_drop)options.push('Multi Drop');
  return options.join(' + ');
}
function travelDay(value?:string|null){return value?new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)):null;}

export function ProviderTruckMarketBoard({filters,result}:{filters:Filters;result:BoardResult}){
  const activeFilters=[
    filters.movementScope?filters.movementScope==='LOCAL'?`Local: ${filters.locality||'selected area'}`:`${filters.origin||'City 1'} to ${filters.destination||'City 2'}`:null,
    filters.status?filters.status.toLowerCase():null,
    filters.loadType?`Accepts ${filters.loadType}`:null,
    filters.vehicleCategory||null,
    filters.freshness?filters.freshness==='FRESH'?'Current':'Update needed':null,
    filters.currentAreaPlaceRef?`Near ${filters.currentArea||'selected area'}`:null
  ].filter(Boolean).map(label=>({label:String(label)}));
  return <div className="page">
    <PageHeader icon={Truck} title="Truck Board" subtitle="See one anonymous signal for every visible truck."/>
    <div className="alert market-gauge-alert"><Truck aria-hidden="true"/>Anonymous market view. Truck owners, identifiers, contacts, and actions stay private.</div>
    <BoardFilterSheet title="Find truck supply" description="Filter the operational signals visible in the market." applyLabel="Show trucks" clearHref="/app/capacity" resultLabel={`${result.total} ${result.total===1?'truck':'trucks'}`} activeFilters={activeFilters}>
      <div className="board-filter-grid">
        <BoardGeographyFilters idPrefix="capacity-provider" movementScope={filters.movementScope} localPlaceRef={filters.localPlaceRef} locality={filters.locality} localRadiusKm={filters.localRadiusKm} originPlaceRef={filters.originPlaceRef} origin={filters.origin} originRadiusKm={filters.originRadiusKm} destinationPlaceRef={filters.destinationPlaceRef} destination={filters.destination} destinationRadiusKm={filters.destinationRadiusKm} directionMode={filters.directionMode} routeLabels={['Route city 1','Route city 2']}/>
        <div className="form-group"><label htmlFor="provider-status"><Gauge aria-hidden="true"/>Availability</label><select id="provider-status" name="status" defaultValue={filters.status}><option value="">Empty or Partial</option><option value="EMPTY">Empty</option><option value="PARTIAL">Partial</option></select></div>
        <div className="form-group"><label htmlFor="provider-load-type"><Boxes aria-hidden="true"/>Accepts</label><select id="provider-load-type" name="loadType" defaultValue={filters.loadType}><option value="">Any shipment size</option><option value="FTL">Full Truckload (FTL)</option><option value="PTL">Partial Truckload (PTL)</option></select></div>
        <div className="form-group"><label htmlFor="provider-truck-type"><Truck aria-hidden="true"/>Cargo configuration</label><select id="provider-truck-type" name="vehicleCategory" defaultValue={filters.vehicleCategory}><option value="">All truck types</option>{VEHICLE_CONFIGURATIONS.map(type=><option value={type.name} key={type.name}>{type.name}</option>)}</select></div>
      </div>
      <section className="board-more-filters">
        <h3><SlidersHorizontal aria-hidden="true"/>More filters</h3>
        <div className="board-filter-grid">
          <div className="form-group"><label htmlFor="provider-freshness"><CalendarClock aria-hidden="true"/>Freshness</label><select id="provider-freshness" name="freshness" defaultValue={filters.freshness}><option value="">Any update age</option><option value="FRESH">Current</option><option value="UPDATE_NEEDED">Update needed</option></select></div>
          <div className="form-group"><label htmlFor="provider-current-area"><MapPin aria-hidden="true"/>Truck area near</label><EthiopiaPlaceInput id="provider-current-area" name="currentArea" placeRefName="currentAreaPlaceRef" defaultPlaceRef={filters.currentAreaPlaceRef} defaultValue={filters.currentArea} placeholder="Adama, Ethiopia"/></div>
          <div className="form-group"><label htmlFor="provider-current-radius"><CircleDotDashed aria-hidden="true"/>Search radius</label><select id="provider-current-radius" name="currentAreaRadiusKm" defaultValue={filters.currentAreaRadiusKm}><option value="25">25 km</option><option value="50">50 km</option><option value="100">100 km</option><option value="200">200 km</option></select></div>
          <input type="hidden" name="currentAreaMode" value="REQUIRE"/>
        </div>
      </section>
    </BoardFilterSheet>
    <section className="capacity-market-grid">{result.items.map((truck,index)=><article className="card capacity-market-card provider-market-card" key={`${truck.updated_at}-${truck.cargo_configuration}-${index}`}>
      <div className="market-card-top"><div className="market-truck-heading"><div className="truck-status-visual"><Image className="truck-thumbnail large" src={vehicleConfigurationImage(truck.cargo_configuration)} alt={truck.cargo_configuration} width={120} height={120}/></div><div><div className="status-row"><StatusPill status={truck.status}/><StatusPill status={truck.freshness}/></div><h2>{truck.cargo_configuration}</h2><div className="meta">Anonymous truck signal</div></div></div><strong className="market-capacity-value">{capacityLabel(truck.status)}</strong></div>
      {truck.freshness==='UPDATE_NEEDED'?<div className="alert warning stale-capacity-alert"><CalendarClock aria-hidden="true"/>Old update. Treat this only as a market signal.</div>:null}
      <div className="market-signal-grid">
        <div><small><MapPin aria-hidden="true"/>Current area</small><strong>{truck.movement_scope!=='INTERCITY'&&truck.local_place_label?`${truck.local_place_label} · ${truck.local_radius_km} km radius`:truck.location_area||truck.origin||'Area not updated'}</strong><span>{truck.location_updated_at?`Location ${relativeTime(truck.location_updated_at)}`:'Location time unavailable'}</span></div>
        <div><small><Route aria-hidden="true"/>{truck.status==='PARTIAL'?'Live partial route':'Planned empty route'}</small>{truck.status==='PARTIAL'?<><strong>{truck.current_route_origin||'Not recorded'} → {truck.current_route_destination||'Not recorded'}</strong><span>Live now · refreshed {relativeTime(truck.updated_at)}</span></>:truck.origin&&truck.destination?<><strong>{truck.origin} → {truck.destination}</strong><span>{travelDay(truck.travel_date)||'Travel day not selected'}</span></>:<><strong>Willing to go anywhere</strong><span>{truck.movement_scope==='LOCAL'?'Within the selected Local area':'No specific route selected'}</span></>}</div>
        <div><small><Boxes aria-hidden="true"/>Accepting</small><strong>{acceptedLoads(truck)}</strong>{stopPolicy(truck)?<span>{stopPolicy(truck)}</span>:null}</div>
        <div><small><Camera aria-hidden="true"/>Proof signal</small><strong>{truck.proof_available?'Photo recorded':'No photo'}</strong><span>{truck.proof_recorded_at?relativeTime(truck.proof_recorded_at):'Not recorded'}</span></div>
      </div>
    </article>)}</section>
    {!result.items.length?<div className="empty-state">No truck signals match these filters.</div>:null}
    <Pagination path="/app/capacity" query={filters} page={result.page} pageCount={result.pageCount} total={result.total}/>
  </div>;
}
