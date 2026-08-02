import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listMyShipments, paginateResults } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { Flash } from '@/components/flash';
import { priceDisplay } from '@/lib/ui';
import { CalendarClock, CirclePlus, ClipboardList, ClockAlert, Handshake, History, ListChecks, MapPin, PackageSearch, Search, Send, X } from 'lucide-react';
import { Pagination } from '@/components/pagination';

export default async function ShipmentsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser();
  const query=await searchParams;
  const isBusiness=['SHIPPER','RECEIVER'].includes(user.role);
  const availableViews=isBusiness
    ? [{id:'ALL',label:'All',icon:ClipboardList},{id:'POSTED',label:'Posted',icon:Send},{id:'TRACKING',label:'Tracking',icon:PackageSearch},{id:'HISTORY',label:'History',icon:History}]
    : [{id:'ALL',label:'All',icon:ClipboardList},{id:'INTERESTED',label:'Interested',icon:Handshake},{id:'DIRECT',label:'Direct requests',icon:Send},{id:'TRACKING',label:'Tracking',icon:PackageSearch},{id:'HISTORY',label:'History',icon:History}];
  const requestedView=String(query.view||'ALL').toUpperCase();
  const view=availableViews.some(item=>item.id===requestedView)?requestedView:'ALL';
  const shipments:any[]=listMyShipments(user);
  const search=String(query.q||'').trim().toLowerCase();
  const status=String(query.status||'ALL').toUpperCase();
  const filtered=shipments
    .filter(shipment=>view==='ALL'||shipment.workspace_stage===view)
    .filter(shipment=>status==='ALL'||shipment.operational_status===status)
    .filter(shipment=>!search||[
      shipment.code,shipment.title,
      shipment.shipper_name,shipment.receiver_name,shipment.cargo_description
    ].some(value=>String(value||'').toLowerCase().includes(search)));
  const result:any=paginateResults(filtered,{page:query.page,pageSize:12});
  const overdueLoads=isBusiness?shipments.filter(shipment=>shipment.workspace_stage==='POSTED'&&['PAST_DUE','EXPIRED'].includes(shipment.board_deadline_state)):[];
  const hiddenLoadCount=overdueLoads.filter(shipment=>shipment.board_deadline_state==='EXPIRED').length;
  const visibleStatuses=['POSTED','SENT','CONTACTED','AGREED','ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED','COMPLETED','CANCELLED'];
  return <div className="page">
    <PageHeader icon={ClipboardList} title="My Shipments" subtitle={isBusiness?'Posted work, Tracking, and history.':'Interests, direct requests, Tracking, and history.'} action={isBusiness?<Link href="/app/shipments/new" className="button icon-button-label"><CirclePlus aria-hidden="true"/>Post shipment</Link>:undefined}/>
    <Flash error={query.error} success={query.success}/>
    {overdueLoads.length?<div className="permission-note warning"><ClockAlert aria-hidden="true"/><div><strong>{overdueLoads.length} {overdueLoads.length===1?'shipment needs':'shipments need'} review</strong><span>{hiddenLoadCount?`${hiddenLoadCount} ${hiddenLoadCount===1?'is':'are'} now off the Shipment Board. `:''}Past-due requests stay on the Board for two full grace days, then remain only in My Shipments.</span></div></div>:null}
    <nav className="board-view-tabs shipment-stage-tabs" aria-label="My Shipments categories">{availableViews.map(item=>{const Icon=item.icon;return <Link key={item.id} className={`button icon-button-label ${view===item.id?'':'secondary'}`} href={`/app/shipments${item.id==='ALL'?'':`?view=${item.id}`}`}><Icon aria-hidden="true"/>{item.label}</Link>;})}</nav>
    <form className="board-filter-bar compact-list-filter" method="get">
      <input type="hidden" name="view" value={view}/>
      <div className="form-group"><label htmlFor="shipment-search"><Search aria-hidden="true"/>Search shipments</label><input id="shipment-search" name="q" defaultValue={query.q||''} placeholder="Code, title, Business, or cargo"/></div>
      <div className="form-group"><label htmlFor="shipment-status"><ListChecks aria-hidden="true"/>Status</label><select id="shipment-status" name="status" defaultValue={status}><option value="ALL">All statuses</option>{visibleStatuses.map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select></div>
      <button className="button icon-button-label"><Search aria-hidden="true"/>Filter</button>
      {search||status!=='ALL'?<Link className="button secondary icon-button-label" href={`/app/shipments${view==='ALL'?'':`?view=${view}`}`}><X aria-hidden="true"/>Clear</Link>:null}
    </form>
    <div className="tracking-list">{result.items.map((shipment:any)=><Link href={`/app/shipments/${shipment.id}`} className="tracking-row" key={shipment.id}><div className="tracking-row-icon">{shipment.workspace_stage==='INTERESTED'?<Handshake aria-hidden="true"/>:shipment.workspace_stage==='DIRECT'?<Send aria-hidden="true"/>:shipment.workspace_stage==='TRACKING'?<PackageSearch aria-hidden="true"/>:shipment.workspace_stage==='HISTORY'?<History aria-hidden="true"/>:<ClipboardList aria-hidden="true"/>}</div><div><strong>{shipment.title}</strong><div className="meta">{shipment.code} · {shipment.shipper_name}{shipment.receiver_name?` to ${shipment.receiver_name}`:''}{isBusiness&&shipment.workspace_stage==='POSTED'?` · ${shipment.interest_count||0} interested`:''}</div></div><div><div className="route"><MapPin aria-hidden="true"/>{shipment.origin}<span>→</span>{shipment.destination}</div><div className="meta icon-meta"><CalendarClock aria-hidden="true"/>Pick up before {shipment.pickup_date}{shipment.delivery_date?` · Drop off before ${shipment.delivery_date}`:''}</div>{shipment.board_deadline_state==='PAST_DUE'?<span className="status orange">2-day Board grace</span>:shipment.board_deadline_state==='EXPIRED'?<span className="status expired">Off Shipment Board</span>:null}</div><div><strong>{priceDisplay(shipment)}</strong><div className="meta">{shipment.load_type==='FTL'?'Full Truckload (FTL)':shipment.load_type==='PTL'?'Partial Truckload (PTL)':'Size not set'}</div></div><StatusPill status={shipment.operational_status}/></Link>)}</div>
    {!result.items.length?<div className="empty-state"><ClipboardList aria-hidden="true"/><strong>No {availableViews.find(item=>item.id===view)?.label.toLowerCase()} shipments match.</strong><span>{search||status!=='ALL'?'Clear or change the current filters.':isBusiness?'Post a shipment to reach permitted transport providers.':'Use the Shipment Board to find work; recorded interactions appear here.'}</span></div>:null}
    <Pagination path="/app/shipments" query={{view:view==='ALL'?undefined:view,q:query.q,status:status==='ALL'?undefined:status}} page={result.page} pageCount={result.pageCount} total={result.total}/>
  </div>;
}
