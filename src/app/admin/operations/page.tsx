
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, BadgeDollarSign, Building2, Eye, Gauge, PackageSearch, Route, Search, Trash2, Truck, UserRoundCog, Users } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAdminOperations, hasPlatformPermission, PLATFORM_PERMISSIONS } from '@/lib/platform-admin.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { relativeTime } from '@/lib/ui';
import { Pagination } from '@/components/pagination';

const views=[
  {id:'WORKSPACES',label:'Clients',icon:Building2,permission:'CUSTOMERS'},
  {id:'USERS',label:'Users',icon:Users,permission:'CUSTOMERS'},
  {id:'TRUCKS',label:'Trucks',icon:Truck,permission:'OPERATIONS'},
  {id:'DRIVERS',label:'Driver Access',icon:UserRoundCog,permission:'OPERATIONS'},
  {id:'TRACKING',label:'Tracking',icon:PackageSearch,permission:'OPERATIONS'},
  {id:'CAPACITY',label:'Capacity',icon:Gauge,permission:'OPERATIONS'},
  {id:'ROUTES',label:'Routes',icon:Route,permission:'OPERATIONS'},
  {id:'SUBSCRIPTIONS',label:'Plans',icon:BadgeDollarSign,permission:'BILLING'}
] as const;

function workspaceTypeLabel(type:string){
  if(['ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER'].includes(type))return 'Business';
  if(type==='TRANSPORT_COMPANY')return 'Fleet transporter';
  if(type==='SELF_MANAGED_DRIVER')return 'Self-managed driver';
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
  const requested=String(query.view||'WORKSPACES').toUpperCase();
  const view=allowedViews.some(item=>item.id===requested)?requested:allowedViews[0].id;
  const data:any=await getAdminOperations(user,query.q||'',{...query,view});
  const records:any[]=data.items;
  const returnTo=`/admin/operations?view=${view}${query.q?`&q=${encodeURIComponent(query.q)}`:''}&page=${data.pagination.page}`;

  return <div className="page admin-operations">
    <PageHeader title={<Text message="Platform Records"/>} subtitle={<Text message="Find and manage one record type at a time."/>}/>
    <Flash error={query.error} success={query.success}/>
    <section className="stats compact-admin-stats">
      <div className="stat"><span className="meta"><Text message="Clients"/></span><strong>{data.counts.workspaces}</strong></div>
      <div className="stat"><span className="meta"><Text message="Users"/></span><strong>{data.counts.users}</strong></div>
      <div className="stat"><span className="meta"><Text message="Trucks"/></span><strong>{data.counts.trucks}</strong></div>
      <div className="stat"><span className="meta"><Text message="Tracking"/></span><strong>{data.counts.tracking}</strong></div>
      <div className="stat"><span className="meta"><Text message="Current capacity"/></span><strong>{data.counts.board_capacity}</strong></div>
    </section>
    <Localized as="nav" copy={["aria-label"]} className="admin-view-tabs" aria-label="Platform record type">
      {allowedViews.map(item=>{const Icon=item.icon;return <Link key={item.id} className={view===item.id?'active':''} href={`/admin/operations?view=${item.id}${query.q?`&q=${encodeURIComponent(query.q)}`:''}`}><Icon aria-hidden="true"/>{item.label}</Link>;})}
    </Localized>
    <form className="admin-view-picker" method="get"><div className="form-group"><label htmlFor="admin-management-area"><Activity aria-hidden="true"/><Text message="Management area"/></label><select id="admin-management-area" name="view" defaultValue={view}>{allowedViews.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></div><button className="button small"><Text message="Open"/></button></form>
    <form className="board-filter-bar" method="get">
      <input type="hidden" name="view" value={view}/>
      <div className="form-group"><label htmlFor="operations-search"><Search aria-hidden="true"/><Text message="Search "/>{views.find(item=>item.id===view)?.label}</label><Localized as="input" copy={["placeholder"]} id="operations-search" name="q" defaultValue={query.q||''} placeholder="Name, account, truck number, or shipment code"/></div>
      <button className="button icon-button-label"><Search aria-hidden="true"/><Text message="Search"/></button>
      {data.query?<Link href={`/admin/operations?view=${view}`} className="button secondary"><Text message="Clear"/></Link>:null}
    </form>

    <section className="admin-record-section">
      <div className="admin-record-list">
        {view==='USERS'?records.map(record=><article key={record.id}><div><strong>{record.name}</strong><span>{record.email} · {record.phone||'Phone not added'}</span><small>{record.workspace_name} · {record.role.replaceAll('_',' ')}</small></div><StatusPill status={record.active?'ACTIVE':'SUSPENDED'}/><Link className="button secondary small" href={recordHref(view,record)}><Eye aria-hidden="true"/><Text message="Open"/></Link><form action={`/api/admin/records/user/${record.id}`} method="post"><input type="hidden" name="returnTo" value={returnTo}/>{!record.active?<input type="hidden" name="active" value="on"/>:null}<button className={`button small icon-button-label ${record.active?'danger':'success'}`} disabled={record.id===user.id}>{record.active?<Text message="Suspend"/>:<Text message="Restore"/>}</button></form></article>):null}
        {view==='WORKSPACES'?records.map(record=><article key={`${record.record_kind}-${record.id}`}><div><strong>{record.name}</strong><span>{workspaceTypeLabel(record.type)} · {record.city||'Location not added'}</span><small>{record.user_count}<Text message=" users · "/>{record.truck_count}<Text message=" active trucks · "/>{record.tracking_count}<Text message=" Tracking sessions"/></small></div><StatusPill status={record.subscription_status||'NO PLAN'}/><Link className="button secondary small" href={recordHref(view,record)}><Eye aria-hidden="true"/><Text message="Open"/></Link></article>):null}
        {view==='TRUCKS'?records.map(record=><article key={record.id}><div><strong>{record.platform_number} · {record.make} {record.model}</strong><span>{record.owner_name} · {record.cargo_configuration}<Text message=" · plate "/>{record.plate||'not recorded'}</span><small>{record.capacity_status?`${record.capacity_status.replaceAll('_',' ')} · ${record.location_area||'Area not updated'} · ${relativeTime(record.capacity_updated_at)}`:<Text message="No capacity update"/>}</small></div><StatusPill status={record.active?'ACTIVE':'INACTIVE'}/><Link className="button secondary small" href={recordHref(view,record)}><Eye aria-hidden="true"/><Text message="Open"/></Link><form action={`/api/admin/records/vehicle/${record.id}`} method="post"><input type="hidden" name="returnTo" value={returnTo}/>{!record.active?<input type="hidden" name="active" value="on"/>:null}<button className={`button small icon-button-label ${record.active?'danger':'success'}`}>{record.active?<Text message="Deactivate"/>:<Text message="Reactivate"/>}</button></form></article>):null}
        {view==='DRIVERS'?records.map(record=><article key={record.id}><div><strong>{record.name}</strong><span>{record.owner_name} · {record.platform_number||'No assigned truck'}</span><small>{[record.can_manage_capacity?'Capacity updates':null,record.can_manage_tracking?'Tracking updates':null].filter(Boolean).join(' · ')||'Duty control only'}</small></div><StatusPill status={record.active?'ACTIVE':'SUSPENDED'}/><Link className="button secondary small" href={recordHref(view,record)}><Eye aria-hidden="true"/><Text message="Open"/></Link><details className="admin-inline-actions"><summary className="button small secondary"><Text message="Permissions"/></summary><form action={`/api/admin/records/driver_permissions/${record.id}`} method="post" className="team-permission-grid"><input type="hidden" name="returnTo" value={returnTo}/><label className="checkbox-control"><input name="canManageCapacity" type="checkbox" defaultChecked={Boolean(record.can_manage_capacity)}/><Text message="Capacity updates"/></label><label className="checkbox-control"><input name="canManageTracking" type="checkbox" defaultChecked={Boolean(record.can_manage_tracking)}/><Text message="Tracking updates"/></label><button className="button small"><Text message="Save"/></button></form></details><form action={`/api/admin/records/driver/${record.id}`} method="post">{!record.active?<input type="hidden" name="active" value="on"/>:null}<input type="hidden" name="returnTo" value={returnTo}/><button className={`button small ${record.active?'danger':'success'}`}>{record.active?<Text message="Suspend"/>:<Text message="Restore"/>}</button></form></article>):null}
        {view==='TRACKING'?records.map(record=><article key={record.id}><div><strong>{record.code} · {record.cargo_summary}</strong><span>{record.origin} → {record.destination}</span><small>{record.provider_name} · {record.platform_number}<Text message=" · Driver "/>{record.driver_name}<Text message=" · updated "/>{relativeTime(record.updated_at)}</small></div><StatusPill status={record.operational_status}/><Link className="button secondary small" href={recordHref(view,record)}><PackageSearch aria-hidden="true"/><Text message="Open Tracking"/></Link>{record.provider_handle?<Link className="button secondary small" href={`/@${record.provider_handle}`}><Building2 aria-hidden="true"/><Text message="Transporter"/></Link>:null}</article>):null}
        {view==='CAPACITY'?records.map(record=><article key={record.id}><div><strong>{record.platform_number} · {record.make} {record.model}</strong><span>{record.owner_name} · {record.location_area||'Area not updated'}</span><small>{record.status==='PARTIAL'?<Text message="Partial space"/>:record.status==='EMPTY'?<Text message="Empty truck"/>:record.status==='OFF_DUTY'?<Text message="Off Duty"/>:record.status.replaceAll('_',' ')} · {record.visibility.replaceAll('_',' ')}<Text message=" · updated "/>{relativeTime(record.updated_at)}</small></div><StatusPill status={record.status}/><Link className="button secondary small" href={recordHref(view,record)}><Eye aria-hidden="true"/><Text message="Open"/></Link>{record.status!=='OFF_DUTY'?<form action={`/api/admin/records/capacity/${record.id}`} method="post"><input type="hidden" name="command" value="OFF_DUTY"/><input type="hidden" name="returnTo" value={returnTo}/><button className="button small danger"><Gauge aria-hidden="true"/><Text message="Off Duty"/></button></form>:null}</article>):null}
        {view==='ROUTES'?records.map(record=><article key={`${record.record_kind}-${record.id}`}><div><strong>{record.owner_name}</strong><span>{record.geometry==='RADIUS'?`Area around ${record.origin}`:`${record.origin} → ${record.destination}`}</span><small>{record.geometry==='RADIUS'?<Text message="Service area"/>:<Text message="Regular route"/>}<Text message=" · added "/>{relativeTime(record.created_at)}</small></div><StatusPill status={record.geometry==='RADIUS'?'SERVICE_AREA':'ROUTE'}/><Link className="button secondary small" href={recordHref(view,record)}><Eye aria-hidden="true"/><Text message="Open"/></Link><form action={`/api/admin/records/${record.record_kind.toLowerCase()}/${record.id}`} method="post"><input type="hidden" name="command" value="REMOVE"/><input type="hidden" name="returnTo" value={returnTo}/><button className="button small danger"><Trash2 aria-hidden="true"/><Text message="Remove"/></button></form></article>):null}
        {view==='SUBSCRIPTIONS'?records.map(record=><article key={record.id}><div><strong>{record.owner_name}</strong><span>{record.plan_name} · {record.billing_model.replaceAll('_',' ')}</span><small>{record.ends_at?`Ends ${new Date(record.ends_at).toLocaleDateString()}`:<Text message="No expiry"/>}<Text message=" · updated "/>{relativeTime(record.updated_at)}</small></div><StatusPill status={record.status}/><Link className="button secondary small" href={recordHref(view,record)}><Eye aria-hidden="true"/><Text message="Open"/></Link><details className="admin-inline-actions"><summary className="button small secondary"><Text message="Manage"/></summary><form action={`/api/admin/records/subscription/${record.id}`} method="post" className="button-row"><input type="hidden" name="returnTo" value={returnTo}/><button className="button small success" name="command" value="PAID"><Text message="Paid · 30 days"/></button><button className="button small danger" name="command" value="EXPIRE"><Text message="Expire"/></button></form></details></article>):null}
      </div>
      {!records.length?<div className="empty-state"><Text message="No "/>{views.find(item=>item.id===view)?.label.toLowerCase()}<Text message=" match this search."/></div>:null}
      <Pagination path="/admin/operations" query={{q:query.q,view}} page={data.pagination.page} pageCount={data.pagination.pageCount} total={data.pagination.total}/>
    </section>
    <div className="admin-security-note"><Activity aria-hidden="true"/><Text message="Credentials, sessions, tracking secrets, exact coordinates, and private files are never shown here."/></div>
  </div>;
}
