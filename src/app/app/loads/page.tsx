import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getDriverAccess, listAlongRouteLoads, listLoadsPage, listOwnTruckRouteOptions, listPooledLoads, paginateResults } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { priceDisplay } from '@/lib/ui';
import { StatusPill } from '@/components/status-pill';
import { VEHICLE_CONFIGURATIONS } from '@/lib/vehicle-configurations';
import { ArrowRight, Banknote, Boxes, CalendarClock, CircleDotDashed, Clock3, Eye, Layers3, MapPinned, Phone, Route, Send, SlidersHorizontal, Truck } from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { BoardGeographyFilters } from '@/components/board-geography-filters';
import { BoardFilterSheet } from '@/components/board-filter-sheet';
import { VerificationBadges } from '@/components/verification-badges';

export default async function LoadsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['TRANSPORTER','DRIVER','ADMIN']);
  const access=getDriverAccess(user);
  const canBrowse=access?.can_browse_load_board!==false;
  const canNegotiate=access?.can_negotiate_loads!==false&&access?.can_contact_businesses!==false;
  const query=await searchParams;
  const mode=query.mode||'ALL';
  const board=['SHARED','POOLED'].includes(query.board||'')?'SHARED':'LOADS';
  const sharedMode=query.sharedMode==='ROUTE'?'ROUTE':'POOL';
  const filters={
    q:query.q||'',
    movementScope:query.movementScope||'',
    localPlaceRef:query.localPlaceRef||'',
    locality:query.locality||'',
    localRadiusKm:query.localRadiusKm||'50',
    originPlaceRef:query.originPlaceRef||'',
    origin:query.origin||'',
    originRadiusKm:query.originRadiusKm||'50',
    destinationPlaceRef:query.destinationPlaceRef||'',
    destination:query.destination||'',
    destinationRadiusKm:query.destinationRadiusKm||'50',
    directionMode:query.directionMode||'DIRECT',
    loadType:query.loadType||'',
    vehicleCategory:query.vehicleCategory||'',
    matchCapacityId:query.matchCapacityId||'',
    priceMode:query.priceMode||'',
    minPriceEtb:query.minPriceEtb||'',
    maxPriceEtb:query.maxPriceEtb||'',
    pickupBy:query.pickupBy||'',
    deliveryBy:query.deliveryBy||'',
    postedWithin:query.postedWithin||''
  };
  const loadResult:any=board==='LOADS'?listLoadsPage(user,mode,filters,{page:query.page,pageSize:12}):paginateResults([],{page:1,pageSize:12});
  const poolResult:any=paginateResults(board==='SHARED'&&sharedMode==='POOL'?listPooledLoads(user,filters):[],{page:query.page,pageSize:12});
  const routeResult:any=paginateResults(board==='SHARED'&&sharedMode==='ROUTE'?listAlongRouteLoads(user,filters):[],{page:query.page,pageSize:12});
  const loads:any[]=loadResult.items;
  const pools:any[]=poolResult.items;
  const routeChains:any[]=routeResult.items;
  const truckRoutes:any[]=listOwnTruckRouteOptions(user);
  const result=board==='LOADS'?loadResult:sharedMode==='POOL'?poolResult:routeResult;
  const resultCount=result.total;
  const clearFilterHref=(keys:string[])=>{
    const params=new URLSearchParams();
    const values:Record<string,string>={board,sharedMode,mode,...filters};
    Object.entries(values).forEach(([key,value])=>{
      if(!keys.includes(key)&&value&&!(key==='board'&&value==='LOADS')&&!(key==='sharedMode'&&value==='POOL')&&!(key==='mode'&&value==='ALL')) params.set(key,value);
    });
    const queryString=params.toString();
    return `/app/loads${queryString?`?${queryString}`:''}`;
  };
  const activeFilters=[
    mode!=='ALL'?{label:mode==='INTERESTED'?'My interests':mode==='PARTNERS'?'My Partners':mode==='OPEN'?'Open Shipments':'Direct',href:clearFilterHref(['mode'])}:null,
    filters.matchCapacityId?{label:'Matched to truck route',href:clearFilterHref(['matchCapacityId'])}:null,
    filters.movementScope==='LOCAL'?{label:`Local: ${filters.locality||'selected place'}`,href:clearFilterHref(['movementScope','localPlaceRef','locality','localRadiusKm'])}:null,
    filters.movementScope==='INTERCITY'?{label:`${filters.origin||'City 1'} to ${filters.destination||'City 2'}`,href:clearFilterHref(['movementScope','originPlaceRef','origin','originRadiusKm','destinationPlaceRef','destination','destinationRadiusKm','directionMode'])}:null,
    filters.loadType?{label:filters.loadType,href:clearFilterHref(['loadType'])}:null,
    filters.vehicleCategory?{label:filters.vehicleCategory,href:clearFilterHref(['vehicleCategory'])}:null,
    filters.priceMode?{label:filters.priceMode.replaceAll('_',' ').toLowerCase(),href:clearFilterHref(['priceMode'])}:null,
    filters.minPriceEtb?{label:`From ${filters.minPriceEtb} ETB`,href:clearFilterHref(['minPriceEtb'])}:null,
    filters.maxPriceEtb?{label:`Up to ${filters.maxPriceEtb} ETB`,href:clearFilterHref(['maxPriceEtb'])}:null,
    filters.pickupBy?{label:`Pick up by ${filters.pickupBy}`,href:clearFilterHref(['pickupBy'])}:null,
    filters.deliveryBy?{label:`Drop off by ${filters.deliveryBy}`,href:clearFilterHref(['deliveryBy'])}:null,
    filters.postedWithin?{label:`Posted ${filters.postedWithin.toLowerCase()}`,href:clearFilterHref(['postedWithin'])}:null
  ].filter(Boolean) as {label:string;href:string}[];

  return <div className="page">
    <PageHeader icon={Boxes} title="Shipment Board" subtitle="Find freight for your truck."/>
    <Flash error={query.error} success={query.success}/>
    {!canBrowse?<div className="permission-note"><SlidersHorizontal aria-hidden="true"/><div><strong>Shipment Board access is managed by your fleet owner</strong><span>You can continue using duty and assigned tracking workflows.</span></div></div>:<>
      <nav className="board-view-tabs" aria-label="Shipment Board tabs">
        <Link className={`button icon-button-label ${board==='LOADS'?'':'secondary'}`} href="/app/loads"><Boxes aria-hidden="true"/>Shipments</Link>
        <Link className={`button icon-button-label ${board==='SHARED'?'':'secondary'}`} href="/app/loads?board=SHARED"><Layers3 aria-hidden="true"/>Shared Shipments</Link>
      </nav>
      {board==='SHARED'?<nav className="shared-mode-tabs" aria-label="Shared shipment strategy">
        <Link className={sharedMode==='POOL'?'active':''} href="/app/loads?board=SHARED"><Layers3 aria-hidden="true"/><span><strong>Pool together</strong><small>Share most of one trip</small></span></Link>
        <Link className={sharedMode==='ROUTE'?'active':''} href="/app/loads?board=SHARED&sharedMode=ROUTE"><MapPinned aria-hidden="true"/><span><strong>Along the route</strong><small>Pick up after each drop</small></span></Link>
      </nav>:null}
      <BoardFilterSheet
        title={board==='SHARED'?(sharedMode==='POOL'?'Find shipments to pool':'Find shipments along one route'):'Find demand for a truck'}
        description={board==='SHARED'?'Suggestions only. Each shipment stays separate.':"Search or rank shipments against one truck's route."}
        applyLabel={board==='SHARED'?'Show matches':'Show shipments'}
        clearHref={`/app/loads${board==='SHARED'?`?board=SHARED${sharedMode==='ROUTE'?'&sharedMode=ROUTE':''}`:''}`}
        resultLabel={`${resultCount} ${board==='SHARED'?(resultCount===1?'candidate':'candidates'):(resultCount===1?'shipment':'shipments')}`}
        activeFilters={activeFilters}
        search={{
          id:'load-search',
          value:filters.q,
          placeholder:'Shipment, business, or cargo',
          hiddenFields:{board,sharedMode,mode,...filters,q:''}
        }}
      >
        <input type="hidden" name="board" value={board}/>
        {board==='SHARED'?<input type="hidden" name="sharedMode" value={sharedMode}/>:null}
        <div className="board-filter-grid">
          {board==='LOADS'&&truckRoutes.length?<div className="form-group filter-match"><label htmlFor="load-match"><Route aria-hidden="true"/>Match truck routes</label><select id="load-match" name="matchCapacityId" defaultValue={filters.matchCapacityId}><option value="">Do not rank by a truck</option>{truckRoutes.map(truck=><option value={truck.id} key={truck.id}>{truck.option_label}{truck.origin&&truck.destination?` · ${truck.origin} → ${truck.destination}`:''}</option>)}</select></div>:null}
          {board==='LOADS'?<BoardGeographyFilters idPrefix="load" movementScope={filters.movementScope} localPlaceRef={filters.localPlaceRef} locality={filters.locality} localRadiusKm={filters.localRadiusKm} originPlaceRef={filters.originPlaceRef} origin={filters.origin} originRadiusKm={filters.originRadiusKm} destinationPlaceRef={filters.destinationPlaceRef} destination={filters.destination} destinationRadiusKm={filters.destinationRadiusKm} directionMode={filters.directionMode}/>:null}
          {board==='LOADS'?<><div className="form-group"><label htmlFor="load-type"><Boxes aria-hidden="true"/>Shipment size</label><select id="load-type" name="loadType" defaultValue={filters.loadType}><option value="">FTL or PTL</option><option value="FTL">FTL</option><option value="PTL">PTL</option></select></div>
          <div className="form-group"><label htmlFor="load-truck-type"><Truck aria-hidden="true"/>Cargo configuration</label><select id="load-truck-type" name="vehicleCategory" defaultValue={filters.vehicleCategory}><option value="">All truck types</option>{VEHICLE_CONFIGURATIONS.map(type=><option value={type.name} key={type.name}>{type.name}</option>)}</select></div>
          <div className="form-group"><label htmlFor="load-visibility"><Eye aria-hidden="true"/>Board view</label><select id="load-visibility" name="mode" defaultValue={mode}><option value="ALL">All permitted shipments</option><option value="INTERESTED">My interests</option><option value="DIRECT">Direct</option><option value="PARTNERS">My Partners</option><option value="OPEN">Open Shipments</option></select></div></>:null}
        </div>
        {board==='LOADS'?<section className="board-more-filters">
          <h3><SlidersHorizontal aria-hidden="true"/>More filters</h3>
          <div className="board-filter-grid">
            <div className="form-group"><label htmlFor="load-price-mode"><Banknote aria-hidden="true"/>Price type</label><select id="load-price-mode" name="priceMode" defaultValue={filters.priceMode}><option value="">Any price type</option><option value="FIXED_PRICE">Fixed price</option><option value="TARGET_PRICE">Target price</option><option value="QUOTE_REQUESTED">Quote requested</option></select></div>
            <div className="form-group"><label htmlFor="load-min-price"><Banknote aria-hidden="true"/>Minimum ETB</label><input id="load-min-price" name="minPriceEtb" type="number" min="1" step="1" defaultValue={filters.minPriceEtb} placeholder="Any"/></div>
            <div className="form-group"><label htmlFor="load-max-price"><Banknote aria-hidden="true"/>Maximum ETB</label><input id="load-max-price" name="maxPriceEtb" type="number" min="1" step="1" defaultValue={filters.maxPriceEtb} placeholder="Any"/></div>
            <div className="form-group"><label htmlFor="load-pickup-by"><CalendarClock aria-hidden="true"/>Pick up before or on</label><input id="load-pickup-by" name="pickupBy" type="date" defaultValue={filters.pickupBy}/></div>
            <div className="form-group"><label htmlFor="load-delivery-by"><CalendarClock aria-hidden="true"/>Drop off before or on</label><input id="load-delivery-by" name="deliveryBy" type="date" defaultValue={filters.deliveryBy}/></div>
            <div className="form-group"><label htmlFor="load-posted-within"><Clock3 aria-hidden="true"/>Posted within</label><select id="load-posted-within" name="postedWithin" defaultValue={filters.postedWithin}><option value="">Any time</option><option value="24H">Last 24 hours</option><option value="3D">Last 3 days</option><option value="7D">Last 7 days</option></select></div>
          </div>
          <p className="meta">Minimum or maximum ETB applies to Fixed and Target prices. Quote Requested shipments have no comparable saved amount.</p>
        </section>:null}
      </BoardFilterSheet>

      {board==='LOADS'?<div className="stack" data-testid="load-list">{loads.map((load:any)=><article className="card load-board-card" key={load.id}><div className="load-board-layout"><div><div className="status-row"><StatusPill status={load.distribution_mode}/><span className="status">{load.shipper_name}</span><span className="status green">{load.load_type||'Shipment type missing'}</span><span className="status">{load.movement_scope==='LOCAL'?'Local':'Between cities'}</span>{load.interested?<span className="status green">Interest sent</span>:null}{load.route_match_label?<span className={`route-match match-${load.route_match_score}`}><Route aria-hidden="true"/>{load.route_match_label}{load.route_match_source?` · ${load.route_match_platform_number} ${load.route_match_source}`:''}</span>:null}</div><h3>{load.title}</h3>{load.movement_scope==='LOCAL'?<div className="route local-route"><CircleDotDashed aria-hidden="true"/><span>Local in {load.local_place_label}</span></div>:<div className="route">{load.origin}<span>→</span>{load.destination}</div>}<div className="meta">{load.movement_scope==='LOCAL'&&[load.pickup_area_label,load.dropoff_area_label].filter(Boolean).length?[load.pickup_area_label,load.dropoff_area_label].filter(Boolean).join(' → '):null}{load.movement_scope==='LOCAL'&&[load.pickup_area_label,load.dropoff_area_label].filter(Boolean).length?' · ':''}Pick up before {load.pickup_date} · {load.vehicle_category||'Vehicle discussed directly'}</div><p>{load.cargo_description}</p><VerificationBadges badges={load.owner_verification_badges} compact label="Shipment owner" reviewCount={load.owner_review_count} averageRating={load.owner_average_rating}/></div><div className="load-board-actions"><strong>{priceDisplay(load)}</strong><div className="meta">Posted {new Date(load.created_at).toLocaleString()}</div><div className="hero-actions"><Link className="button secondary icon-button-label" href={`/app/shipments/${load.id}`}><Eye aria-hidden="true"/>Details</Link>{load.load_contact_phone?<a className="button secondary icon-button-label" href={`tel:${load.load_contact_phone}`}><Phone aria-hidden="true"/>Call</a>:null}{canNegotiate&&!load.interested?<form action={`/api/shipments/${load.id}/interest`} method="post"><button className="button icon-button-label"><Send aria-hidden="true"/>Express interest</button></form>:null}</div></div></div></article>)}</div>
      :sharedMode==='POOL'?<div className="stack" data-testid="pooled-load-list">{pools.map(pool=><article className="card shared-candidate-card" key={pool.id}><div><div className="status-row"><span className="status green">Pool together</span><span className="status">{pool.member_count} PTL shipments</span></div><h3>{pool.origin} area <ArrowRight aria-hidden="true"/> {pool.destination} area</h3><p>Every origin and destination matches every other shipment in this candidate.</p><div className="shared-match-facts"><span><CircleDotDashed aria-hidden="true"/>Origins within {pool.origin_spread_km} km</span><span><CircleDotDashed aria-hidden="true"/>Destinations within {pool.destination_spread_km} km</span><span><CalendarClock aria-hidden="true"/>{pool.earliest_pickup||'No pickup date'} to {pool.latest_delivery||'No drop-off date'}</span></div></div><Link className="button secondary icon-button-label" href={`/app/loads/pstl/${pool.id}`}><Eye aria-hidden="true"/>View {pool.member_count} shipments</Link></article>)}</div>
      :<div className="stack" data-testid="along-route-list">{routeChains.map(chain=><article className="card shared-candidate-card along-route-card" key={chain.id}><div><div className="status-row"><span className="status blue">Along the route</span><span className="status">{chain.member_count} shipments</span><span className="status">{chain.members.filter((load:any)=>load.load_type==='FTL').length} FTL · {chain.members.filter((load:any)=>load.load_type==='PTL').length} PTL</span></div><h3>{chain.origin} <ArrowRight aria-hidden="true"/> {chain.destination}</h3><div className="route-stop-preview">{chain.members.slice(0,5).map((load:any,index:number)=><span key={load.id}><i>{index+1}</i>{load.origin.replace(', Ethiopia','')} <ArrowRight aria-hidden="true"/> {load.destination.replace(', Ethiopia','')}</span>)}{chain.member_count>5?<span>+{chain.member_count-5} more</span>:null}</div><div className="shared-match-facts"><span><Route aria-hidden="true"/>{chain.loaded_distance_km} km carrying shipments</span><span><MapPinned aria-hidden="true"/>{chain.connector_distance_km} km between shipments</span><span><CalendarClock aria-hidden="true"/>{chain.earliest_pickup||'No pickup date'} to {chain.latest_delivery||'No drop-off date'}</span></div></div><Link className="button secondary icon-button-label" href={`/app/loads/route/${chain.id}`}><Eye aria-hidden="true"/>View route</Link></article>)}</div>}
      {!resultCount?<div className="empty-state">{board==='SHARED'?(sharedMode==='POOL'?'No pairwise-compatible PTL pools match these filters. Individual shipments remain on Shipments.':'No forward shipment sequences match these filters. Individual shipments remain on Shipments.'):'No shipments match these filters.'}</div>:null}
      <Pagination path="/app/loads" query={{board,sharedMode,mode,...filters}} page={result.page} pageCount={result.pageCount} total={result.total}/>
    </>}
  </div>;
}
