import styles from '@/app/admin/admin-presentation.module.css';

import {listProviderTrackingAppeals} from '@/lib/provider-tracking.js';
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, Building2, Eye, Gauge, PackageSearch, Route, Search, Trash2, Truck, UserRoundCog, Users } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAdminOperations, hasPlatformPermission, PLATFORM_PERMISSIONS } from '@/lib/platform-admin.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { relativeTime } from '@/lib/ui';
import { Pagination } from '@/components/pagination';

const views=[
  {id:'USERS',label:'Accounts',icon:Users,permission:'CUSTOMERS'},
  {id:'WORKSPACES',label:'Provider accounts',icon:Building2,permission:'CUSTOMERS'},
  {id:'TRUCKS',label:'Vehicles',icon:Truck,permission:'OPERATIONS'},
  {id:'DRIVERS',label:'Driver Access',icon:UserRoundCog,permission:'OPERATIONS'},
  {id:'TRACKING',label:'Tracking',icon:PackageSearch,permission:'OPERATIONS'},
  {id:'CAPACITY',label:'Capacity',icon:Gauge,permission:'OPERATIONS'},
  {id:'ROUTES',label:'Routes',icon:Route,permission:'OPERATIONS'},
] as const;

function workspaceTypeLabel(type:string){
  if(['ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER'].includes(type))return 'Business';
  if(type==='TRANSPORT_COMPANY')return 'Transport Provider';
  if(['SELF_MANAGED_DRIVER','OWNER_OPERATOR','INDEPENDENT_PROVIDER'].includes(type))return 'Transport Provider';
  return type.replaceAll('_',' ').toLowerCase();
}

function recordHref(view:string,record:any){
  const kind=record.record_kind?`?kind=${encodeURIComponent(record.record_kind)}`:'';
  return `/admin/operations/${view.toLowerCase()}/${record.id}${kind}`;
}

export default async function AdminOperationsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['ADMIN','SUPPORT'],{allowLimited:true});
  const query=await searchParams;
  const allowedViews=views.filter(item=>hasPlatformPermission(user,PLATFORM_PERMISSIONS[item.permission]));
  if(!allowedViews.length)redirect('/support');
  const requested=String(query.view||'USERS').toUpperCase();
  const view=allowedViews.some(item=>item.id===requested)?requested:allowedViews[0].id;
  const data:any=await getAdminOperations(user,query.q||'',{...query,view});
  const records:any[]=data.items;
  const appeals=view==='TRACKING'?await listProviderTrackingAppeals(user):[];
  const returnTo=`/admin/operations?view=${view}${query.q?`&q=${encodeURIComponent(query.q)}`:''}&page=${data.pagination.page}`;

  return <div className={"page admin-operations "+styles.workspace}>
    <PageHeader title={<Text message={view==='USERS'?'Accounts':view==='WORKSPACES'?'Provider accounts':'Platform Records'}/>}/>
    {user.role==='ADMIN'&&view==='TRUCKS'?<Link href="/admin/devices" className="button secondary small"><Text message="GPS devices"/></Link>:null}
    <Flash error={query.error} success={query.success}/>
    {user.role==='ADMIN'&&view==='USERS'?<Link href="/admin/privacy" className="button secondary"><Text message="Account deletion requests"/></Link>:null}
    <section className={"stats compact-admin-stats "+styles.compactCounts}>
      <div className="stat"><span className="meta"><Text message="Clients"/></span><strong>{data.counts.workspaces}</strong></div>
      <div className="stat"><span className="meta"><Text message="Users"/></span><strong>{data.counts.users}</strong></div>
      <div className="stat"><span className="meta"><Text message="Vehicles"/></span><strong>{data.counts.trucks}</strong></div>
      <div className="stat"><span className="meta"><Text message="Tracking"/></span><strong>{data.counts.tracking}</strong></div>
      <div className="stat"><span className="meta"><Text message="Current capacity"/></span><strong>{data.counts.board_capacity}</strong></div>
    </section>
    <Localized as="nav" copy={["aria-label"]} className="admin-view-tabs" aria-label="Platform record type">
      {allowedViews.filter(item=>item.id!=='WORKSPACES').map(item=>{const Icon=item.icon;return <Link key={item.id} className={view===item.id?'active':''} href={`/admin/operations?view=${item.id}${query.q?`&q=${encodeURIComponent(query.q)}`:''}`}><Icon aria-hidden="true"/>{item.label}</Link>;})}
    </Localized>

    {view==='TRACKING'&&appeals.length?<section className="card"><h2><Text message="Unloading appeals"/></h2>{appeals.length?appeals.map((appeal:any)=><article key={appeal.id}><strong>{appeal.code}</strong><p>{appeal.reason}</p><Link className="button secondary small" href={`/admin/operations/tracking/${appeal.shipment_id}`}><Text message="Review shipment"/></Link></article>):<p className="meta"><Text message="No open unloading appeals."/></p>}</section>:null}
    <form className="board-filter-bar" method="get">
      <input type="hidden" name="view" value={view}/>
      <div className="form-group"><label htmlFor="operations-search"><Search aria-hidden="true"/><Text message="Search "/>{views.find(item=>item.id===view)?.label}</label><Localized as="input" copy={["placeholder"]} id="operations-search" name="q" defaultValue={query.q||''} placeholder="Name, account, vehicle number, or shipment code"/></div>
      <button className="button icon-button-label"><Search aria-hidden="true"/><Text message="Search"/></button>
      {data.query?<Link href={`/admin/operations?view=${view}`} className="button secondary"><Text message="Clear"/></Link>:null}
    </form>

    <section className="admin-record-section">
      <div className="admin-record-list">
        {view==='USERS'?records.map(record=><article key={record.id}><div><strong>{record.name}</strong><span>{record.email} · {record.phone||'Phone not added'}</span><small>{record.workspace_name} · {<Text message={record.role==='TRANSPORTER'?'Transport Provider':record.role==='DRIVER'?'Driver':record.role==='SUPPORT'?'Team member':record.role==='ADMIN'?'Administrator':'Account'}/>}</small></div><StatusPill status={record.active?'ACTIVE':'SUSPENDED'}/><div className={styles.rowActions}><Link className="button secondary small" href={recordHref(view,record)}><Eye aria-hidden="true"/><Text message="Open"/></Link></div></article>):null}
        {view==='WORKSPACES'?records.map(record=><article key={`${record.record_kind}-${record.id}`}><div><strong>{record.name}</strong><span>{workspaceTypeLabel(record.type)} · {record.city||'Location not added'}</span><small>{record.user_count}<Text message=" users · "/>{record.truck_count}<Text message=" active vehicles · "/>{record.tracking_count}<Text message=" Tracking sessions"/></small></div><div className={styles.rowActions}><Link className="button secondary small" href={recordHref(view,record)}><Eye aria-hidden="true"/><Text message="Open"/></Link></div></article>):null}
        {view==='TRUCKS'?records.map(record=><article key={record.id}><div><strong>{record.platform_number} · {record.make} {record.model}</strong><span>{record.owner_name} · {record.cargo_configuration}<Text message=" · plate "/>{record.plate||'not recorded'}</span><small>{record.capacity_status?`${record.capacity_status.replaceAll('_',' ')} · ${record.location_area||'Area not updated'} · ${relativeTime(record.capacity_updated_at)}`:<Text message="No capacity update"/>}</small></div><StatusPill status={record.active?'ACTIVE':'INACTIVE'}/><div className={styles.rowActions}><Link className="button secondary small" href={recordHref(view,record)}><Eye aria-hidden="true"/><Text message="Open"/></Link></div></article>):null}
        {view==='DRIVERS'?records.map(record=><article key={record.id}><div><strong>{record.name}</strong><span>{record.owner_name} · {record.platform_number||'No assigned vehicle'}</span><small>{[record.can_manage_capacity?'Capacity updates':null,record.can_manage_tracking?'Tracking updates':null].filter(Boolean).join(' · ')||'Duty control only'}</small></div><StatusPill status={record.active?'ACTIVE':'SUSPENDED'}/><div className={styles.rowActions}><Link className="button secondary small" href={recordHref(view,record)}><Eye aria-hidden="true"/><Text message="Open"/></Link></div></article>):null}
        {view==='TRACKING'?records.map(record=><article key={record.id}><div><strong>{record.code} · {record.cargo_summary}</strong><span>{record.origin} → {record.destination}</span><small>{record.provider_name} · {record.platform_number}<Text message=" · Driver "/>{record.driver_name}<Text message=" · updated "/>{relativeTime(record.updated_at)}</small></div><StatusPill status={record.operational_status}/><div className={styles.rowActions}><Link className="button secondary small" href={recordHref(view,record)}><PackageSearch aria-hidden="true"/><Text message="Open Tracking"/></Link>{record.provider_handle?<Link className="button secondary small" href={`/@${record.provider_handle}`}><Building2 aria-hidden="true"/><Text message="Transporter"/></Link>:null}</div></article>):null}
        {view==='CAPACITY'?records.map(record=><article key={record.id}><div><strong>{record.platform_number} · {record.make} {record.model}</strong><span>{record.owner_name} · {record.location_area||'Area not updated'}</span><small>{record.status==='PARTIAL'?<Text message="Partial space"/>:record.status==='EMPTY'?<Text message="Empty vehicle"/>:record.status==='OFF_DUTY'?<Text message="Off Duty"/>:record.status.replaceAll('_',' ')} · {record.visibility.replaceAll('_',' ')}<Text message=" · updated "/>{relativeTime(record.updated_at)}</small></div><StatusPill status={record.status}/><div className={styles.rowActions}><Link className="button secondary small" href={recordHref(view,record)}><Eye aria-hidden="true"/><Text message="Open"/></Link></div></article>):null}
        {view==='ROUTES'?records.map(record=><article key={`${record.record_kind}-${record.id}`}><div><strong>{record.owner_name}</strong><span>{record.geometry==='RADIUS'?`Area around ${record.origin}`:`${record.origin} → ${record.destination}`}</span><small>{record.geometry==='RADIUS'?<Text message="Service area"/>:<Text message="Regular route"/>}<Text message=" · added "/>{relativeTime(record.created_at)}</small></div><StatusPill status={record.geometry==='RADIUS'?'SERVICE_AREA':'ROUTE'}/><div className={styles.rowActions}><Link className="button secondary small" href={recordHref(view,record)}><Eye aria-hidden="true"/><Text message="Open"/></Link></div></article>):null}
      </div>
      {!records.length?<div className="empty-state"><Text message="No "/>{views.find(item=>item.id===view)?.label.toLowerCase()}<Text message=" match this search."/></div>:null}
      <Pagination path="/admin/operations" query={{q:query.q,view}} page={data.pagination.page} pageCount={data.pagination.pageCount} total={data.pagination.total}/>
    </section>

  </div>;
}
