import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getDriverAccess, listLoadsPage, listOwnTruckRouteOptions, listPooledLoads, paginateResults } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { priceDisplay } from '@/lib/ui';
import { StatusPill } from '@/components/status-pill';
import { VEHICLE_CONFIGURATIONS } from '@/lib/vehicle-configurations';
import { Banknote, Boxes, CalendarClock, CircleDotDashed, Clock3, Eye, Layers3, Phone, Route, Search, Send, SlidersHorizontal, X } from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { BoardGeographyFilters } from '@/components/board-geography-filters';

export default async function LoadsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['TRANSPORTER','DRIVER','ADMIN']);
  const access=getDriverAccess(user);
  const canBrowse=access?.can_browse_load_board!==false;
  const canNegotiate=access?.can_negotiate_loads!==false&&access?.can_contact_businesses!==false;
  const query=await searchParams;
  const mode=query.mode||'ALL';
  const board=query.board==='POOLED'?'POOLED':'LOADS';
  const filters={
    q:query.q||'',
    movementScope:query.movementScope||'',
    localPlaceRef:query.localPlaceRef||'',
    locality:query.locality||'',
    origin:query.origin||'',
    destination:query.destination||'',
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
  const poolResult:any=paginateResults(board==='POOLED'?listPooledLoads(user,filters):[],{page:query.page,pageSize:12});
  const loads:any[]=loadResult.items;
  const pools:any[]=poolResult.items;
  const truckRoutes:any[]=listOwnTruckRouteOptions(user);
  const hasFilters=mode!=='ALL'||Object.values(filters).some(Boolean);
  const hasAdvancedFilters=['priceMode','minPriceEtb','maxPriceEtb','pickupBy','deliveryBy','postedWithin'].some(key=>Boolean(filters[key as keyof typeof filters]));
  const result=board==='LOADS'?loadResult:poolResult;
  const resultCount=result.total;

  return <div className="page">
    <PageHeader title="Load Board" subtitle="Find individual freight demand or compatible PTL loads that may share one truck."/>
    <Flash error={query.error} success={query.success}/>
    {!canBrowse?<div className="permission-note"><SlidersHorizontal aria-hidden="true"/><div><strong>Load Board access is managed by your fleet owner</strong><span>You can continue using duty and assigned tracking workflows.</span></div></div>:<>
      <nav className="board-view-tabs" aria-label="Load Board tabs">
        <Link className={`button icon-button-label ${board==='LOADS'?'':'secondary'}`} href="/app/loads"><Boxes aria-hidden="true"/>Loads</Link>
        <Link className={`button icon-button-label ${board==='POOLED'?'':'secondary'}`} href="/app/loads?board=POOLED"><Layers3 aria-hidden="true"/>Pooled shared truckload</Link>
      </nav>
      <form className="board-filter-panel" method="get">
        <input type="hidden" name="board" value={board}/>
        <div className="board-filter-heading"><SlidersHorizontal aria-hidden="true"/><div><h2>{board==='POOLED'?'Find compatible PTL groups':'Find demand for a truck'}</h2><p>{board==='POOLED'?'Groups are a read-only view; every member remains a separate load.':"Search the board or rank loads against one truck's recorded route."}</p></div></div>
        <div className="board-filter-grid">
          <div className="form-group filter-search"><label htmlFor="load-search"><Search aria-hidden="true"/>Search</label><input id="load-search" name="q" defaultValue={filters.q} placeholder="Load, Business, cargo, or city"/></div>
          {board==='LOADS'&&truckRoutes.length?<div className="form-group filter-match"><label htmlFor="load-match"><Route aria-hidden="true"/>Match truck routes</label><select id="load-match" name="matchCapacityId" defaultValue={filters.matchCapacityId}><option value="">Do not rank by a truck</option>{truckRoutes.map(truck=><option value={truck.id} key={truck.id}>{truck.option_label}{truck.origin&&truck.destination?` · ${truck.origin} → ${truck.destination}`:''}</option>)}</select></div>:null}
          {board==='LOADS'?<BoardGeographyFilters idPrefix="load" movementScope={filters.movementScope} localPlaceRef={filters.localPlaceRef} locality={filters.locality} origin={filters.origin} destination={filters.destination}/>:null}
          {board==='LOADS'?<><div className="form-group"><label htmlFor="load-type">Load size</label><select id="load-type" name="loadType" defaultValue={filters.loadType}><option value="">FTL or PTL</option><option value="FTL">FTL</option><option value="PTL">PTL</option></select></div>
          <div className="form-group"><label htmlFor="load-truck-type">Cargo configuration</label><select id="load-truck-type" name="vehicleCategory" defaultValue={filters.vehicleCategory}><option value="">All truck types</option>{VEHICLE_CONFIGURATIONS.map(type=><option value={type.name} key={type.name}>{type.name}</option>)}</select></div>
          <div className="form-group"><label htmlFor="load-visibility">Board view</label><select id="load-visibility" name="mode" defaultValue={mode}><option value="ALL">All permitted loads</option><option value="INTERESTED">My interests</option><option value="DIRECT">Direct</option><option value="PARTNERS">My Partners</option><option value="OPEN">Open Loads</option></select></div></>:null}
        </div>
        {board==='LOADS'?<details className="board-more-filters" open={hasAdvancedFilters}>
          <summary><SlidersHorizontal aria-hidden="true"/>More filters</summary>
          <div className="board-filter-grid">
            <div className="form-group"><label htmlFor="load-price-mode"><Banknote aria-hidden="true"/>Price type</label><select id="load-price-mode" name="priceMode" defaultValue={filters.priceMode}><option value="">Any price type</option><option value="FIXED_PRICE">Fixed price</option><option value="TARGET_PRICE">Target price</option><option value="QUOTE_REQUESTED">Quote requested</option></select></div>
            <div className="form-group"><label htmlFor="load-min-price"><Banknote aria-hidden="true"/>Minimum ETB</label><input id="load-min-price" name="minPriceEtb" type="number" min="1" step="1" defaultValue={filters.minPriceEtb} placeholder="Any"/></div>
            <div className="form-group"><label htmlFor="load-max-price"><Banknote aria-hidden="true"/>Maximum ETB</label><input id="load-max-price" name="maxPriceEtb" type="number" min="1" step="1" defaultValue={filters.maxPriceEtb} placeholder="Any"/></div>
            <div className="form-group"><label htmlFor="load-pickup-by"><CalendarClock aria-hidden="true"/>Pick up before or on</label><input id="load-pickup-by" name="pickupBy" type="date" defaultValue={filters.pickupBy}/></div>
            <div className="form-group"><label htmlFor="load-delivery-by"><CalendarClock aria-hidden="true"/>Drop off before or on</label><input id="load-delivery-by" name="deliveryBy" type="date" defaultValue={filters.deliveryBy}/></div>
            <div className="form-group"><label htmlFor="load-posted-within"><Clock3 aria-hidden="true"/>Posted within</label><select id="load-posted-within" name="postedWithin" defaultValue={filters.postedWithin}><option value="">Any time</option><option value="24H">Last 24 hours</option><option value="3D">Last 3 days</option><option value="7D">Last 7 days</option></select></div>
          </div>
          <p className="meta">Minimum or maximum ETB applies to Fixed and Target prices. Quote Requested loads have no comparable saved amount.</p>
        </details>:null}
        <div className="board-filter-actions"><button className="button icon-button-label"><Search aria-hidden="true"/>{board==='POOLED'?'Show matching pools':'Show matching loads'}</button>{hasFilters?<Link href={`/app/loads${board==='POOLED'?'?board=POOLED':''}`} className="button secondary icon-button-label"><X aria-hidden="true"/>Clear</Link>:null}<span className="meta">{resultCount} {board==='POOLED'?(resultCount===1?'pool':'pools'):(resultCount===1?'load':'loads')} found</span></div>
      </form>

      {board==='LOADS'?<div className="stack" data-testid="load-list">{loads.map((load:any)=><article className="card load-board-card" key={load.id}><div className="load-board-layout"><div><div className="status-row"><StatusPill status={load.distribution_mode}/><span className="status">{load.shipper_name}</span><span className="status green">{load.load_type||'Load type missing'}</span><span className="status">{load.movement_scope==='LOCAL'?'Local':'Between cities'}</span>{load.interested?<span className="status green">Interest sent</span>:null}{load.route_match_label?<span className={`route-match match-${load.route_match_score}`}><Route aria-hidden="true"/>{load.route_match_label}{load.route_match_source?` · ${load.route_match_platform_number} ${load.route_match_source}`:''}</span>:null}</div><h3>{load.title}</h3>{load.movement_scope==='LOCAL'?<div className="route local-route"><CircleDotDashed aria-hidden="true"/><span>Local in {load.local_place_label}</span></div>:<div className="route">{load.origin}<span>→</span>{load.destination}</div>}<div className="meta">{load.movement_scope==='LOCAL'&&[load.pickup_area_label,load.dropoff_area_label].filter(Boolean).length?[load.pickup_area_label,load.dropoff_area_label].filter(Boolean).join(' → '):null}{load.movement_scope==='LOCAL'&&[load.pickup_area_label,load.dropoff_area_label].filter(Boolean).length?' · ':''}Pick up before {load.pickup_date} · {load.vehicle_category||'Vehicle discussed directly'}</div><p>{load.cargo_description}</p></div><div className="load-board-actions"><strong>{priceDisplay(load)}</strong><div className="meta">Posted {new Date(load.created_at).toLocaleString()}</div><div className="hero-actions"><Link className="button secondary icon-button-label" href={`/app/shipments/${load.id}`}><Eye aria-hidden="true"/>Details</Link>{load.load_contact_phone?<a className="button secondary icon-button-label" href={`tel:${load.load_contact_phone}`}><Phone aria-hidden="true"/>Call</a>:null}{canNegotiate&&!load.interested?<form action={`/api/shipments/${load.id}/interest`} method="post"><button className="button icon-button-label"><Send aria-hidden="true"/>Express interest</button></form>:null}</div></div></div></article>)}</div>
      :<div className="stack" data-testid="pooled-load-list">{pools.map(pool=><article className="card pooled-load-card" key={pool.id}><div><div className="status-row"><span className="status green">PSTL</span><span className="status">{pool.member_count} PTL loads</span></div><h3>Pooled shared truckload</h3><div className="route">{pool.origin}<span>→</span>{pool.destination}</div><p>Compatible origins and destinations. Multi Pick and Multi Drop may be required.</p><div className="meta">Earliest pick up before {pool.earliest_pickup||'Not set'}{pool.latest_delivery?` · Latest drop off before ${pool.latest_delivery}`:''}</div></div><Link className="button secondary icon-button-label" href={`/app/loads/pstl/${pool.id}`}><Eye aria-hidden="true"/>View {pool.member_count} loads</Link></article>)}</div>}
      {!resultCount?<div className="empty-state">{board==='POOLED'?'No compatible posted PTL groups match these filters. Individual loads remain on the Loads tab.':'No loads match these filters.'}</div>:null}
      <Pagination path="/app/loads" query={{board,mode,...filters}} page={result.page} pageCount={result.pageCount} total={result.total}/>
    </>}
  </div>;
}
