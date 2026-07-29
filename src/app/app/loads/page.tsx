import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getDriverAccess, listLoads, listOwnTruckRouteOptions, listPooledLoads } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { priceDisplay } from '@/lib/ui';
import { StatusPill } from '@/components/status-pill';
import { VEHICLE_CONFIGURATIONS } from '@/lib/vehicle-configurations';
import { Boxes, Eye, Layers3, MapPin, Phone, Route, Search, Send, SlidersHorizontal, X } from 'lucide-react';
import { EthiopiaPlaceInput } from '@/components/ethiopia-place-input';

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
    origin:query.origin||'',
    destination:query.destination||'',
    loadType:query.loadType||'',
    vehicleCategory:query.vehicleCategory||'',
    matchCapacityId:query.matchCapacityId||''
  };
  const loads:any[]=board==='LOADS'?listLoads(user,mode,filters):[];
  const pools:any[]=board==='POOLED'?listPooledLoads(user,filters):[];
  const truckRoutes:any[]=listOwnTruckRouteOptions(user);
  const hasFilters=mode!=='ALL'||Object.values(filters).some(Boolean);
  const resultCount=board==='LOADS'?loads.length:pools.length;

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
          <div className="form-group"><label htmlFor="load-origin"><MapPin aria-hidden="true"/>Origin area</label><EthiopiaPlaceInput id="load-origin" name="origin" defaultValue={filters.origin} placeholder="Addis Ababa, Ethiopia"/></div>
          <div className="form-group"><label htmlFor="load-destination"><MapPin aria-hidden="true"/>Destination area</label><EthiopiaPlaceInput id="load-destination" name="destination" defaultValue={filters.destination} placeholder="Hawassa, Ethiopia"/></div>
          {board==='LOADS'?<><div className="form-group"><label htmlFor="load-type">Load size</label><select id="load-type" name="loadType" defaultValue={filters.loadType}><option value="">FTL or PTL</option><option value="FTL">FTL</option><option value="PTL">PTL</option></select></div>
          <div className="form-group"><label htmlFor="load-truck-type">Cargo configuration</label><select id="load-truck-type" name="vehicleCategory" defaultValue={filters.vehicleCategory}><option value="">All truck types</option>{VEHICLE_CONFIGURATIONS.map(type=><option value={type.name} key={type.name}>{type.name}</option>)}</select></div>
          <div className="form-group"><label htmlFor="load-visibility">Board view</label><select id="load-visibility" name="mode" defaultValue={mode}><option value="ALL">All permitted loads</option><option value="INTERESTED">My interests</option><option value="DIRECT">Direct</option><option value="PARTNERS">My Partners</option><option value="OPEN">Open Loads</option></select></div></>:null}
        </div>
        <div className="board-filter-actions"><button className="button icon-button-label"><Search aria-hidden="true"/>{board==='POOLED'?'Show matching pools':'Show matching loads'}</button>{hasFilters?<Link href={`/app/loads${board==='POOLED'?'?board=POOLED':''}`} className="button secondary icon-button-label"><X aria-hidden="true"/>Clear</Link>:null}<span className="meta">{resultCount} {board==='POOLED'?(resultCount===1?'pool':'pools'):(resultCount===1?'load':'loads')} shown</span></div>
      </form>

      {board==='LOADS'?<div className="stack" data-testid="load-list">{loads.map((load:any)=><article className="card load-board-card" key={load.id}><div className="load-board-layout"><div><div className="status-row"><StatusPill status={load.distribution_mode}/><span className="status">{load.shipper_name}</span><span className="status green">{load.load_type||'Load type missing'}</span>{load.interested?<span className="status green">Interest sent</span>:null}{load.route_match_label?<span className={`route-match match-${load.route_match_score}`}><Route aria-hidden="true"/>{load.route_match_label}{load.route_match_source?` · ${load.route_match_platform_number} ${load.route_match_source}`:''}</span>:null}</div><h3>{load.title}</h3><div className="route">{load.origin}<span>→</span>{load.destination}</div><div className="meta">Pick up before {load.pickup_date} · {load.vehicle_category||'Vehicle discussed directly'}</div><p>{load.cargo_description}</p></div><div className="load-board-actions"><strong>{priceDisplay(load)}</strong><div className="meta">Posted {new Date(load.created_at).toLocaleString()}</div><div className="hero-actions"><Link className="button secondary icon-button-label" href={`/app/shipments/${load.id}`}><Eye aria-hidden="true"/>Details</Link>{load.load_contact_phone?<a className="button secondary icon-button-label" href={`tel:${load.load_contact_phone}`}><Phone aria-hidden="true"/>Call</a>:null}{canNegotiate&&!load.interested?<form action={`/api/shipments/${load.id}/interest`} method="post"><button className="button icon-button-label"><Send aria-hidden="true"/>Express interest</button></form>:null}</div></div></div></article>)}</div>
      :<div className="stack" data-testid="pooled-load-list">{pools.map(pool=><article className="card pooled-load-card" key={pool.id}><div><div className="status-row"><span className="status green">PSTL</span><span className="status">{pool.member_count} PTL loads</span></div><h3>Pooled shared truckload</h3><div className="route">{pool.origin}<span>→</span>{pool.destination}</div><p>Compatible origins and destinations. Multi Pick and Multi Drop may be required.</p><div className="meta">Earliest pick up before {pool.earliest_pickup||'Not set'}{pool.latest_delivery?` · Latest drop off before ${pool.latest_delivery}`:''}</div></div><Link className="button secondary icon-button-label" href={`/app/loads/pstl/${pool.id}`}><Eye aria-hidden="true"/>View {pool.member_count} loads</Link></article>)}</div>}
      {!resultCount?<div className="empty-state">{board==='POOLED'?'No compatible posted PTL groups match these filters. Individual loads remain on the Loads tab.':'No loads match these filters.'}</div>:null}
    </>}
  </div>;
}
