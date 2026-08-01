import { BarChart3, CircleDotDashed, Gauge, MapPin, Route, Truck } from 'lucide-react';
import { BoardFilterSheet } from '@/components/board-filter-sheet';
import { BoardGeographyFilters } from '@/components/board-geography-filters';
import { EthiopiaPlaceInput } from '@/components/ethiopia-place-input';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { StatusPill } from '@/components/status-pill';

type Filters=Record<string,string>;
type GaugeResult={
  items:Array<{area_label:string;status:string;movement_scope:string;truck_count:number;accepts_ftl_count:number;accepts_ptl_count:number;fresh_count:number}>;
  total:number;
  truckTotal:number;
  page:number;
  pageCount:number;
};

export function ProviderTruckMarketGauge({filters,result}:{filters:Filters;result:GaugeResult}){
  const activeFilters=[
    filters.movementScope?filters.movementScope==='LOCAL'?`Local · ${filters.locality||'selected area'}`:`${filters.origin||'City 1'} → ${filters.destination||'City 2'}`:null,
    filters.status?filters.status.toLowerCase():null,
    filters.currentAreaPlaceRef?`Near ${filters.currentArea||'selected area'}`:null
  ].filter(Boolean).map(label=>({label:String(label)}));
  return <div className="page">
    <PageHeader icon={BarChart3} title="Truck Board" subtitle="See where truck supply is available."/>
    <div className="alert market-gauge-alert"><Truck aria-hidden="true"/>Market gauge only. Truck and owner details stay private.</div>
    <BoardFilterSheet title="Check truck supply" description="Choose an area, route, or availability." applyLabel="Show supply" clearHref="/app/capacity" resultLabel={`${result.truckTotal} ${result.truckTotal===1?'truck':'trucks'}`} activeFilters={activeFilters}>
      <div className="board-filter-grid">
        <BoardGeographyFilters idPrefix="capacity-gauge" movementScope={filters.movementScope} localPlaceRef={filters.localPlaceRef} locality={filters.locality} localRadiusKm={filters.localRadiusKm} originPlaceRef={filters.originPlaceRef} origin={filters.origin} originRadiusKm={filters.originRadiusKm} destinationPlaceRef={filters.destinationPlaceRef} destination={filters.destination} destinationRadiusKm={filters.destinationRadiusKm} directionMode={filters.directionMode} routeLabels={['Route city 1','Route city 2']}/>
        <div className="form-group"><label htmlFor="gauge-status"><Gauge aria-hidden="true"/>Availability</label><select id="gauge-status" name="status" defaultValue={filters.status}><option value="">All active trucks</option><option value="EMPTY">Empty</option><option value="PARTIAL">Partial</option><option value="BUSY">Busy</option></select></div>
        <div className="form-group"><label htmlFor="gauge-current-area"><MapPin aria-hidden="true"/>Truck area near</label><EthiopiaPlaceInput id="gauge-current-area" name="currentArea" placeRefName="currentAreaPlaceRef" defaultPlaceRef={filters.currentAreaPlaceRef} defaultValue={filters.currentArea} placeholder="Adama, Ethiopia"/></div>
        <div className="form-group"><label htmlFor="gauge-current-radius"><CircleDotDashed aria-hidden="true"/>Search radius</label><select id="gauge-current-radius" name="currentAreaRadiusKm" defaultValue={filters.currentAreaRadiusKm}><option value="25">25 km</option><option value="50">50 km</option><option value="100">100 km</option><option value="200">200 km</option></select></div>
        <input type="hidden" name="currentAreaMode" value="REQUIRE"/>
      </div>
    </BoardFilterSheet>
    <section className="capacity-market-grid">{result.items.map((group,index)=><article className="card market-gauge-card" key={`${group.area_label}-${group.status}-${group.movement_scope}-${index}`}>
      <div className="market-card-top"><div><div className="status-row"><StatusPill status={group.status}/><span className="status">{group.movement_scope==='INTERCITY'?'Between cities':group.movement_scope==='LOCAL'?'Local':'Local + between cities'}</span></div><h2><MapPin aria-hidden="true"/>{group.area_label}</h2></div><strong className="market-capacity-value">{group.truck_count} {group.truck_count===1?'truck':'trucks'}</strong></div>
      <div className="market-signal-grid"><div><small><Truck aria-hidden="true"/>Truck supply</small><strong>{group.truck_count} active</strong><span>{group.fresh_count} recently updated</span></div><div><small><Route aria-hidden="true"/>Work accepted</small><strong>{group.accepts_ftl_count} FTL · {group.accepts_ptl_count} PTL</strong><span>Combined market signal</span></div></div>
    </article>)}</section>
    {!result.items.length?<div className="empty-state">No truck supply matches this area.</div>:null}
    <Pagination path="/app/capacity" query={filters} page={result.page} pageCount={result.pageCount} total={result.total}/>
  </div>;
}
