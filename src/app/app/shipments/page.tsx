import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listOwnedLoads, listVisibleShipments, paginateResults } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { Flash } from '@/components/flash';
import { priceDisplay } from '@/lib/ui';
import { CalendarClock, CirclePlus, ClipboardList, MapPin, PackageSearch, Search, X } from 'lucide-react';
import { Pagination } from '@/components/pagination';

export default async function ShipmentsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser();
  const query=await searchParams;
  const isBusiness=['SHIPPER','RECEIVER'].includes(user.role);
  const view=isBusiness&&query.view!=='TRACKING'?'MY_LOADS':'TRACKING';
  const shipments:any[]=view==='MY_LOADS'?listOwnedLoads(user):listVisibleShipments(user);
  const search=String(query.q||'').trim().toLowerCase();
  const status=String(query.status||'ALL').toUpperCase();
  const filtered=shipments
    .filter(shipment=>status==='ALL'||shipment.operational_status===status)
    .filter(shipment=>!search||[
      shipment.code,shipment.title,shipment.origin,shipment.destination,
      shipment.shipper_name,shipment.receiver_name,shipment.cargo_description
    ].some(value=>String(value||'').toLowerCase().includes(search)));
  const result:any=paginateResults(filtered,{page:query.page,pageSize:12});
  const visibleStatuses=view==='MY_LOADS'
    ? ['POSTED','SENT','CONTACTED','AGREED','ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED','COMPLETED','CANCELLED']
    : ['AGREED','ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED','COMPLETED'];
  return <div className="page">
    <PageHeader title={isBusiness?'My Loads':'Tracking'} subtitle={view==='MY_LOADS'?'All posted, negotiating, active, and completed demand owned by this Business.':'Agreed, assigned, active, and completed loads involving this workspace.'} action={isBusiness?<Link href="/app/shipments/new" className="button icon-button-label"><CirclePlus aria-hidden="true"/>Post load</Link>:undefined}/>
    <Flash error={query.error} success={query.success}/>
    {isBusiness?<nav className="board-view-tabs" aria-label="My Loads views"><Link className={`button icon-button-label ${view==='MY_LOADS'?'':'secondary'}`} href="/app/shipments"><ClipboardList aria-hidden="true"/>All my loads</Link><Link className={`button icon-button-label ${view==='TRACKING'?'':'secondary'}`} href="/app/shipments?view=TRACKING"><PackageSearch aria-hidden="true"/>Active Tracking</Link></nav>:null}
    <form className="board-filter-bar compact-list-filter" method="get">
      {isBusiness?<input type="hidden" name="view" value={view}/>:null}
      <div className="form-group"><label htmlFor="shipment-search"><Search aria-hidden="true"/>Search loads</label><input id="shipment-search" name="q" defaultValue={query.q||''} placeholder="Code, title, Business, cargo, or city"/></div>
      <div className="form-group"><label htmlFor="shipment-status">Status</label><select id="shipment-status" name="status" defaultValue={status}><option value="ALL">All statuses</option>{visibleStatuses.map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select></div>
      <button className="button icon-button-label"><Search aria-hidden="true"/>Filter</button>
      {search||status!=='ALL'?<Link className="button secondary icon-button-label" href={`/app/shipments${view==='TRACKING'&&isBusiness?'?view=TRACKING':''}`}><X aria-hidden="true"/>Clear</Link>:null}
    </form>
    <div className="tracking-list">{result.items.map((shipment:any)=><Link href={`/app/shipments/${shipment.id}`} className="tracking-row" key={shipment.id}><div className="tracking-row-icon">{view==='MY_LOADS'?<ClipboardList aria-hidden="true"/>:<PackageSearch aria-hidden="true"/>}</div><div><strong>{shipment.title}</strong><div className="meta">{shipment.code} · {shipment.shipper_name}{shipment.receiver_name?` to ${shipment.receiver_name}`:''}{view==='MY_LOADS'?` · ${shipment.interest_count||0} interested`:''}</div></div><div><div className="route"><MapPin aria-hidden="true"/>{shipment.origin}<span>→</span>{shipment.destination}</div><div className="meta icon-meta"><CalendarClock aria-hidden="true"/>Pick up before {shipment.pickup_date}{shipment.delivery_date?` · Drop off before ${shipment.delivery_date}`:''}</div></div><div><strong>{priceDisplay(shipment)}</strong><div className="meta">{shipment.load_type}</div></div><StatusPill status={shipment.operational_status}/></Link>)}</div>
    {!result.items.length?<div className="empty-state">{view==='MY_LOADS'?<ClipboardList aria-hidden="true"/>:<PackageSearch aria-hidden="true"/>}<strong>{view==='MY_LOADS'?'No owned loads match.':'No Tracking loads match.'}</strong><span>{search||status!=='ALL'?'Clear or change the current filters.':view==='MY_LOADS'?'Post a load to reach permitted transport providers.':'Posted and negotiating loads stay in My loads or on the Load Board. They appear here after agreement.'}</span></div>:null}
    <Pagination path="/app/shipments" query={{view:isBusiness?view:undefined,q:query.q,status:status==='ALL'?undefined:status}} page={result.page} pageCount={result.pageCount} total={result.total}/>
  </div>;
}
