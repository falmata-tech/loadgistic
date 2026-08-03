import Link from 'next/link';
import Image from 'next/image';
import { requireUser } from '@/lib/auth';
import { listMarketCapacityPage, listOwnLoadRouteOptions, listProviderCapacityBoardPage } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { capacityLabel } from '@/lib/domain.js';
import { relativeTime } from '@/lib/ui';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { VEHICLE_CONFIGURATIONS } from '@/lib/vehicle-configurations';
import { Boxes, Building2, CalendarClock, Camera, CircleDotDashed, Eye, Gauge, MapPin, Phone, Route, SlidersHorizontal, Truck, UserRound } from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { BoardGeographyFilters } from '@/components/board-geography-filters';
import { EthiopiaPlaceInput } from '@/components/ethiopia-place-input';
import { BoardFilterSheet } from '@/components/board-filter-sheet';
import { VerificationBadges } from '@/components/verification-badges';
import { ProviderTruckMarketBoard } from '@/components/provider-truck-market-gauge';

function acceptedLoads(capacity:any) {
  if (capacity.accepts_full_load && capacity.accepts_partial_load) return 'Full or partial truckload';
  if (capacity.accepts_partial_load) return 'Partial Truckload (PTL)';
  return 'Full Truckload (FTL)';
}

function stopPolicy(capacity:any){
  const options=['Direct'];
  if(capacity.accepts_multi_pick)options.push('Multi Pick');
  if(capacity.accepts_multi_drop)options.push('Multi Drop');
  return options.join(' + ');
}

export default async function CapacityPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(); const query=await searchParams; const filters={q:query.q||'',movementScope:query.movementScope||'',localPlaceRef:query.localPlaceRef||'',locality:query.locality||'',localRadiusKm:query.localRadiusKm||'50',originPlaceRef:query.originPlaceRef||'',origin:query.origin||'',originRadiusKm:query.originRadiusKm||'50',destinationPlaceRef:query.destinationPlaceRef||'',destination:query.destination||'',destinationRadiusKm:query.destinationRadiusKm||'50',directionMode:query.directionMode||'DIRECT',currentAreaPlaceRef:query.currentAreaPlaceRef||'',currentArea:query.currentArea||'',currentAreaRadiusKm:query.currentAreaRadiusKm||'50',currentAreaMode:query.currentAreaMode||'PREFER',status:query.status||'',loadType:query.loadType||'',vehicleCategory:query.vehicleCategory||'',matchLoadId:query.matchLoadId||'',minAvailable:query.minAvailable||'',routeBy:query.routeBy||'',visibility:query.visibility||'',freshness:query.freshness||'',stopOption:query.stopOption||'',contractRoutes:query.contractRoutes||'',proof:query.proof||''}; const isProvider=['TRANSPORTER','DRIVER'].includes(user.role); const result:any=isProvider?listProviderCapacityBoardPage(user,filters,{page:query.page,pageSize:12}):listMarketCapacityPage(user,filters,{page:query.page,pageSize:12}); const rows:any[]=result.items; const loadRoutes:any[]=isProvider?[]:listOwnLoadRouteOptions(user);
 if(isProvider)return <ProviderTruckMarketBoard filters={filters} result={result}/>;
 const clearFilterHref=(keys:string[])=>{
   const params=new URLSearchParams();
   Object.entries(filters).forEach(([key,value])=>{ if(!keys.includes(key)&&value) params.set(key,value); });
   const queryString=params.toString();
   return `/app/capacity${queryString?`?${queryString}`:''}`;
 };
 const activeFilters=[
   filters.matchLoadId?{label:'Matched to posted shipment',href:clearFilterHref(['matchLoadId'])}:null,
   filters.movementScope==='LOCAL'?{label:`Local: ${filters.locality||'selected place'}`,href:clearFilterHref(['movementScope','localPlaceRef','locality','localRadiusKm'])}:null,
   filters.movementScope==='INTERCITY'?{label:`${filters.origin||'City 1'} to ${filters.destination||'City 2'}`,href:clearFilterHref(['movementScope','originPlaceRef','origin','originRadiusKm','destinationPlaceRef','destination','destinationRadiusKm','directionMode'])}:null,
   filters.status?{label:filters.status.toLowerCase(),href:clearFilterHref(['status'])}:null,
   filters.loadType?{label:`Accepts ${filters.loadType}`,href:clearFilterHref(['loadType'])}:null,
   filters.vehicleCategory?{label:filters.vehicleCategory,href:clearFilterHref(['vehicleCategory'])}:null,
   filters.minAvailable?{label:`${filters.minAvailable}%+ space`,href:clearFilterHref(['minAvailable'])}:null,
   filters.routeBy?{label:`Route by ${filters.routeBy}`,href:clearFilterHref(['routeBy'])}:null,
   filters.visibility?{label:filters.visibility==='OPEN'?'Public':'Partners',href:clearFilterHref(['visibility'])}:null,
   filters.freshness?{label:filters.freshness==='FRESH'?'Current':'Update needed',href:clearFilterHref(['freshness'])}:null,
   filters.stopOption?{label:filters.stopOption.replaceAll('_',' ').toLowerCase(),href:clearFilterHref(['stopOption'])}:null,
   filters.contractRoutes?{label:'Contract routes',href:clearFilterHref(['contractRoutes'])}:null,
   filters.proof?{label:'Photo proof',href:clearFilterHref(['proof'])}:null,
   filters.currentAreaPlaceRef?{label:`Near ${filters.currentArea||'selected area'}`,href:clearFilterHref(['currentAreaPlaceRef','currentArea','currentAreaRadiusKm','currentAreaMode'])}:null
 ].filter(Boolean) as {label:string;href:string}[];
 return <div className="page"><PageHeader icon={Gauge} title="Truck Board" subtitle={isProvider?'See current truck supply.':'Find an available truck.'}/>
 {isProvider?<div className="alert">The Truck Board is read only for transporters and drivers. Use it to understand supply; contact and interest actions are not available here.</div>:<div className="alert">Each truck stands on its own. Public means all logged-in businesses; Partners means only Connected network Businesses.</div>}
 <BoardFilterSheet
   title="Find the closest capacity"
   description="Search or rank trucks against one of your shipment routes."
   applyLabel="Show trucks"
   clearHref="/app/capacity"
   resultLabel={`${result.total} ${result.total===1?'truck':'trucks'}`}
   activeFilters={activeFilters}
   search={{id:'capacity-search',value:filters.q,placeholder:'Truck, transporter, or cargo',hiddenFields:{...filters,q:''}}}
 >
   <section className="board-filter-step"><div className="workflow-step-heading"><span>1</span><Route aria-hidden="true"/><div><h3>Route or area</h3><p>Choose where the truck should match.</p></div></div><div className="board-filter-grid">
     {loadRoutes.length?<div className="form-group filter-match"><label htmlFor="capacity-match"><Route aria-hidden="true"/>Match a posted shipment</label><select id="capacity-match" name="matchLoadId" defaultValue={filters.matchLoadId}><option value="">Do not rank by a shipment</option>{loadRoutes.map(load=><option key={load.id} value={load.id}>{load.code} · {load.movement_scope==='LOCAL'?`Local in ${load.local_place_label}`:`${load.origin} → ${load.destination}`}</option>)}</select></div>:null}
     <BoardGeographyFilters idPrefix="capacity" movementScope={filters.movementScope} localPlaceRef={filters.localPlaceRef} locality={filters.locality} localRadiusKm={filters.localRadiusKm} originPlaceRef={filters.originPlaceRef} origin={filters.origin} originRadiusKm={filters.originRadiusKm} destinationPlaceRef={filters.destinationPlaceRef} destination={filters.destination} destinationRadiusKm={filters.destinationRadiusKm} directionMode={filters.directionMode} routeLabels={['Route city 1','Route city 2']}/>
     <div className="form-group"><label htmlFor="capacity-current-area"><MapPin aria-hidden="true"/>Current truck area near</label><EthiopiaPlaceInput id="capacity-current-area" name="currentArea" placeRefName="currentAreaPlaceRef" defaultPlaceRef={filters.currentAreaPlaceRef} defaultValue={filters.currentArea} placeholder="Adama, Ethiopia"/></div>
     <div className="form-group"><label htmlFor="capacity-current-area-radius"><CircleDotDashed aria-hidden="true"/>Search radius</label><select id="capacity-current-area-radius" name="currentAreaRadiusKm" defaultValue={filters.currentAreaRadiusKm}><option value="10">10 km</option><option value="25">25 km</option><option value="50">50 km</option><option value="100">100 km</option><option value="200">200 km</option></select></div>
     <div className="form-group"><label htmlFor="capacity-current-area-mode"><CircleDotDashed aria-hidden="true"/>Area match</label><select id="capacity-current-area-mode" name="currentAreaMode" defaultValue={filters.currentAreaMode}><option value="PREFER">Show nearby first</option><option value="REQUIRE">Only nearby trucks</option></select></div>
   </div></section>
   <section className="board-filter-step"><div className="workflow-step-heading"><span>2</span><Truck aria-hidden="true"/><div><h3>Truck and space</h3><p>Choose the capacity you need.</p></div></div><div className="board-filter-grid">
     <div className="form-group"><label htmlFor="capacity-status"><Gauge aria-hidden="true"/>Availability</label><select id="capacity-status" name="status" defaultValue={filters.status}><option value="">Empty, Partial, or Busy</option><option value="EMPTY">Empty</option><option value="PARTIAL">Partial</option><option value="BUSY">Busy · available soon</option></select></div>
     <div className="form-group"><label htmlFor="capacity-load-type"><Boxes aria-hidden="true"/>Accepts</label><select id="capacity-load-type" name="loadType" defaultValue={filters.loadType}><option value="">Any shipment size</option><option value="FTL">Full Truckload (FTL)</option><option value="PTL">Partial Truckload (PTL)</option></select></div>
     <div className="form-group"><label htmlFor="capacity-truck-type"><Truck aria-hidden="true"/>Cargo configuration</label><select id="capacity-truck-type" name="vehicleCategory" defaultValue={filters.vehicleCategory}><option value="">All truck types</option>{VEHICLE_CONFIGURATIONS.map(type=><option value={type.name} key={type.name}>{type.name}</option>)}</select></div>
   </div></section>
   <section className="board-more-filters board-filter-step">
     <div className="workflow-step-heading"><span>3</span><SlidersHorizontal aria-hidden="true"/><div><h3>Refine</h3><p>Only use what matters.</p></div></div>
     <div className="board-filter-grid">
       <div className="form-group"><label htmlFor="capacity-min-space"><Gauge aria-hidden="true"/>At least this much space</label><select id="capacity-min-space" name="minAvailable" defaultValue={filters.minAvailable}><option value="">Any available space</option><option value="25">25% or more</option><option value="50">50% or more</option><option value="75">75% or more</option><option value="100">100% empty</option></select></div>
       <div className="form-group"><label htmlFor="capacity-route-by"><CalendarClock aria-hidden="true"/>Planned trip before or on</label><input id="capacity-route-by" name="routeBy" type="date" defaultValue={filters.routeBy}/></div>
       <div className="form-group"><label htmlFor="capacity-visibility"><Eye aria-hidden="true"/>Visibility</label><select id="capacity-visibility" name="visibility" defaultValue={filters.visibility}><option value="">Public or Partners</option><option value="OPEN">Public</option><option value="SAVED_PARTNERS">Partners</option></select></div>
       <div className="form-group"><label htmlFor="capacity-freshness"><Gauge aria-hidden="true"/>Freshness</label><select id="capacity-freshness" name="freshness" defaultValue={filters.freshness}><option value="">Any update age</option><option value="FRESH">Current</option><option value="UPDATE_NEEDED">Update needed</option></select></div>
       <div className="form-group"><label htmlFor="capacity-stops"><Route aria-hidden="true"/>Route flexibility</label><select id="capacity-stops" name="stopOption" defaultValue={filters.stopOption}><option value="">Any route flexibility</option><option value="DIRECT_ONLY">Direct only</option><option value="MULTI_PICK">Accepts Multi Pick</option><option value="MULTI_DROP">Accepts Multi Drop</option></select></div>
       <div className="form-group"><label htmlFor="capacity-contract-routes"><Route aria-hidden="true"/>Contract routes</label><select id="capacity-contract-routes" name="contractRoutes" defaultValue={filters.contractRoutes}><option value="">Any contract preference</option><option value="YES">Open to contract routes</option></select></div>
       <div className="form-group"><label htmlFor="capacity-proof"><Camera aria-hidden="true"/>Cargo-space proof</label><select id="capacity-proof" name="proof" defaultValue={filters.proof}><option value="">With or without proof</option><option value="RECORDED">Photo recorded</option></select></div>
     </div>
   </section>
 </BoardFilterSheet>
 <section className="capacity-market-grid">{rows.map((cap:any)=><article className="card capacity-market-card" key={cap.id}>
   <div className="market-card-top"><div className="market-truck-heading"><Image className="truck-thumbnail large" src={vehicleConfigurationImage(cap.cargo_configuration||cap.vehicle_category)} alt="" width={120} height={120}/><div><div className="status-row"><StatusPill status={cap.status}/><StatusPill status={cap.freshness}/>{cap.relationshipVisible?<span className="status green">Partners</span>:<span className="status">Public</span>}</div><h2>{cap.vehicle_make} · {cap.vehicle_model}</h2><div className="meta">{cap.platform_number} · {cap.cargo_configuration||cap.vehicle_category}<br/>{cap.organization_name||cap.provider_name}</div></div></div><strong className="market-capacity-value">{capacityLabel(cap.status,cap.available_percent)}</strong></div>
   {cap.status!=='BUSY'?<div className="progress"><span style={{width:`${cap.available_percent}%`}}/></div>:<div className="busy-board-notice"><CalendarClock aria-hidden="true"/><span><strong>Available {cap.available_again_date}{cap.available_again_place_label?` near ${cap.available_again_place_label}`:''}</strong><small>Busy now, but open to calls for future work.</small></span></div>}
   {cap.freshness==='UPDATE_NEEDED'?<div className="alert warning stale-capacity-alert"><CalendarClock aria-hidden="true"/>Old update. Confirm availability before planning.</div>:null}
   <div className="market-signal-grid"><div><small>Current area</small><strong>{cap.movement_scope!=='INTERCITY'&&cap.local_place_label?`${cap.local_place_label} · ${cap.local_radius_km} km radius`:cap.location_area||'Area not updated'}</strong><span>{cap.location_updated_at?`Location ${relativeTime(cap.location_updated_at)}`:'Location time unavailable'}</span></div>{cap.status==='BUSY'?<><div><small>Available near</small><strong>{cap.available_again_place_label||'Expected area not recorded'}</strong><span>{cap.available_again_date?`Ready ${cap.available_again_date}`:'Ready date unavailable'}</span></div><div><small>Preferred Routes</small><strong>{cap.preferred_routes_label||'No routes declared'}</strong><span>Future-work preference, not current cargo space</span></div></>:<><div><small>{cap.status==='PARTIAL'?'Live partial route':'Route plan'}</small>{cap.status==='PARTIAL'?<><strong>{cap.current_route_origin||'Not recorded'} → {cap.current_route_destination||'Not recorded'}</strong><span>Live now · refreshed {relativeTime(cap.updated_at)}</span></>:cap.origin&&cap.destination?<><strong>{cap.origin} → {cap.destination}</strong><span>{cap.travel_date?`Travel ${cap.travel_date}`:'Date not recorded'}</span></>:<><strong>Willing to go anywhere</strong><span>{cap.movement_scope==='LOCAL'?'Within the selected Local area':'No specific route selected'}</span></>}</div><div><small>Accepting</small><strong>{acceptedLoads(cap)}</strong><span>{stopPolicy(cap)} · {cap.open_to_contract_lanes?'Contract routes':'Single-trip work'}</span></div><div><small>Proof signal</small><strong>{cap.proof_available?'Photo recorded':'No photo'}</strong><span>{cap.proof_recorded_at?relativeTime(cap.proof_recorded_at):'Not recorded'}</span></div></>}</div>
   <div className="market-trust-strip"><VerificationBadges badges={cap.owner_verification_badges} compact label={cap.provider_profile_id?'Owner-operator':'Company'}/><VerificationBadges badges={cap.vehicle_verification_badges} compact label="Truck"/>{cap.assigned_driver_name?<VerificationBadges badges={cap.driver_verification_badges} compact label={`Driver · ${cap.assigned_driver_name}`}/>:null}</div>
   <div className="market-card-actions">{cap.route_match_label?<span className={`route-match match-${cap.route_match_score}`}><Route aria-hidden="true"/>{cap.route_match_label}{cap.route_match_source?` · ${cap.route_match_source}`:''}</span>:null}{!isProvider&&cap.provider_contact_phone?<a className="button secondary small icon-button-label" href={`tel:${cap.provider_contact_phone}`}><Phone aria-hidden="true"/>Call</a>:null}<Link className="button secondary small icon-button-label" href={`/app/providers/${cap.organization_handle||cap.provider_handle}`}>{cap.provider_profile_id?<UserRound aria-hidden="true"/>:<Building2 aria-hidden="true"/>}{cap.provider_profile_id?'Owner':'Company'}</Link></div>
 </article>)}</section>{!rows.length?<div className="empty-state">No capacity signals are visible right now.</div>:null}<Pagination path="/app/capacity" query={filters} page={result.page} pageCount={result.pageCount} total={result.total}/></div>;
}
