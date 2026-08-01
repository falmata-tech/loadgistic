import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, BadgeDollarSign, Building2, Gift, Gauge, Network, PackageSearch, Route, Search, Trash2, Truck, UserRoundCog, Users } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAdminOperations, hasPlatformPermission, PLATFORM_PERMISSIONS } from '@/lib/repository.js';
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
  {id:'LOADS',label:'Shipments',icon:PackageSearch,permission:'OPERATIONS'},
  {id:'CAPACITY',label:'Capacity',icon:Gauge,permission:'OPERATIONS'},
  {id:'NETWORK',label:'Network',icon:Network,permission:'OPERATIONS'},
  {id:'ROUTES',label:'Routes',icon:Route,permission:'OPERATIONS'},
  {id:'SUBSCRIPTIONS',label:'Plans',icon:BadgeDollarSign,permission:'BILLING'}
] as const;

function workspaceTypeLabel(type:string){
  if(['ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER'].includes(type))return 'Business';
  if(type==='TRANSPORT_COMPANY')return 'Fleet transporter';
  if(type==='SELF_MANAGED_DRIVER')return 'Self-managed driver';
  return type.replaceAll('_',' ').toLowerCase();
}

export default async function AdminOperationsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['ADMIN','SUPPORT'],{allowLimited:true});
  const query=await searchParams;
  const allowedViews=views.filter(item=>hasPlatformPermission(user,PLATFORM_PERMISSIONS[item.permission]));
  if(!allowedViews.length)redirect('/support');
  const requested=String(query.view||'WORKSPACES').toUpperCase();
  const view=allowedViews.some(item=>item.id===requested)?requested:allowedViews[0].id;
  const data:any=getAdminOperations(user,query.q||'',{...query,view});
  const records:any[]=data.items;
  const returnTo=`/admin/operations?view=${view}${query.q?`&q=${encodeURIComponent(query.q)}`:''}`;

  return <div className="page admin-operations">
    <PageHeader title="Platform Operations" subtitle="Find and manage one connected record type at a time."/>
    <Flash error={query.error} success={query.success}/>
    <section className="stats compact-admin-stats">
      <div className="stat"><span className="meta">Clients</span><strong>{data.counts.workspaces}</strong></div>
      <div className="stat"><span className="meta">Users</span><strong>{data.counts.users}</strong></div>
      <div className="stat"><span className="meta">Trucks</span><strong>{data.counts.trucks}</strong></div>
      <div className="stat"><span className="meta">Shipments</span><strong>{data.counts.loads}</strong></div>
      <div className="stat"><span className="meta">On Board</span><strong>{data.counts.board_capacity}</strong></div>
    </section>
    <nav className="admin-view-tabs" aria-label="Platform record type">
      {allowedViews.map(item=>{const Icon=item.icon;return <Link key={item.id} className={view===item.id?'active':''} href={`/admin/operations?view=${item.id}${query.q?`&q=${encodeURIComponent(query.q)}`:''}`}><Icon aria-hidden="true"/>{item.label}</Link>;})}
    </nav>
    <form className="admin-view-picker" method="get"><div className="form-group"><label htmlFor="admin-management-area"><Activity aria-hidden="true"/>Management area</label><select id="admin-management-area" name="view" defaultValue={view}>{allowedViews.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></div><button className="button small">Open</button></form>
    <form className="board-filter-bar" method="get">
      <input type="hidden" name="view" value={view}/>
      <div className="form-group"><label htmlFor="operations-search"><Search aria-hidden="true"/>Search {views.find(item=>item.id===view)?.label}</label><input id="operations-search" name="q" defaultValue={query.q||''} placeholder="Name, account, truck number, or shipment code"/></div>
      <button className="button icon-button-label"><Search aria-hidden="true"/>Search</button>
      {data.query?<Link href={`/admin/operations?view=${view}`} className="button secondary">Clear</Link>:null}
    </form>

    <section className="admin-record-section">
      <div className="admin-record-list">
        {view==='USERS'?records.map(record=><article key={record.id}><div><strong>{record.name}</strong><span>{record.email} · {record.phone||'Phone not added'}</span><small>{record.workspace_name} · {record.role.replaceAll('_',' ')}</small></div><StatusPill status={record.active?'ACTIVE':'SUSPENDED'}/><form action={`/api/admin/records/user/${record.id}`} method="post">{!record.active?<input type="hidden" name="active" value="on"/>:null}<button className={`button small icon-button-label ${record.active?'danger':'success'}`} disabled={record.id===user.id}>{record.active?'Suspend':'Restore'}</button></form></article>):null}
        {view==='WORKSPACES'?records.map(record=><article key={`${record.record_kind}-${record.id}`}><div><strong>{record.name}</strong><span>{workspaceTypeLabel(record.type)} · {record.city||'Location not added'}</span><small>{record.user_count} users · {record.truck_count} active trucks · {record.load_count} shipments</small></div><StatusPill status={record.subscription_status||'NO PLAN'}/>{record.record_kind==='ORGANIZATION'&&['ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER'].includes(record.type)&&record.subscription_status!=='SPONSORED'?<form action={`/api/admin/workspaces/${record.id}/sponsor`} method="post"><button className="button small secondary icon-button-label"><Gift aria-hidden="true"/>Sponsor</button></form>:null}</article>):null}
        {view==='TRUCKS'?records.map(record=><article key={record.id}><div><strong>{record.platform_number} · {record.make} {record.model}</strong><span>{record.owner_name} · {record.cargo_configuration} · plate {record.plate||'not recorded'}</span><small>{record.capacity_status?`${record.capacity_status.replaceAll('_',' ')} · ${record.location_area||'Area not updated'} · ${relativeTime(record.capacity_updated_at)}`:'No capacity update'}</small></div><StatusPill status={record.active?'ACTIVE':'INACTIVE'}/><form action={`/api/admin/records/vehicle/${record.id}`} method="post">{!record.active?<input type="hidden" name="active" value="on"/>:null}<button className={`button small icon-button-label ${record.active?'danger':'success'}`}>{record.active?'Deactivate':'Reactivate'}</button></form></article>):null}
        {view==='DRIVERS'?records.map(record=><article key={record.id}><div><strong>{record.name}</strong><span>{record.owner_name} · {record.platform_number||'No assigned truck'}</span><small>{[record.can_browse_load_board?'Board':null,record.can_contact_businesses?'Contact':null,record.can_negotiate_loads?'Agreements':null,record.can_manage_capacity?'Capacity':null].filter(Boolean).join(' · ')||'Duty only'}</small></div><StatusPill status={record.active?'ACTIVE':'SUSPENDED'}/><details className="admin-inline-actions"><summary className="button small secondary">Permissions</summary><form action={`/api/admin/records/driver_permissions/${record.id}`} method="post" className="team-permission-grid"><input type="hidden" name="returnTo" value={returnTo}/><label className="checkbox-control"><input name="canBrowseLoadBoard" type="checkbox" defaultChecked={Boolean(record.can_browse_load_board)}/>Board</label><label className="checkbox-control"><input name="canContactBusinesses" type="checkbox" defaultChecked={Boolean(record.can_contact_businesses)}/>Contact</label><label className="checkbox-control"><input name="canNegotiateLoads" type="checkbox" defaultChecked={Boolean(record.can_negotiate_loads)}/>Agreements</label><label className="checkbox-control"><input name="canManageCapacity" type="checkbox" defaultChecked={Boolean(record.can_manage_capacity)}/>Capacity</label><button className="button small">Save</button></form></details><form action={`/api/admin/records/driver/${record.id}`} method="post">{!record.active?<input type="hidden" name="active" value="on"/>:null}<input type="hidden" name="returnTo" value={returnTo}/><button className={`button small ${record.active?'danger':'success'}`}>{record.active?'Suspend':'Restore'}</button></form></article>):null}
        {view==='LOADS'?records.map(record=><article key={record.id}><div><strong>{record.code} · {record.title}</strong><span>{record.origin} → {record.destination}</span><small>Owner: {record.owner_name} · Provider: {record.provider_name||'Not assigned'} · Updated {relativeTime(record.updated_at)}</small></div><StatusPill status={record.operational_status}/><Link className="button secondary small" href={`/app/shipments/${record.id}`}><PackageSearch aria-hidden="true"/>Open</Link></article>):null}
        {view==='CAPACITY'?records.map(record=><article key={record.id}><div><strong>{record.platform_number} · {record.make} {record.model}</strong><span>{record.owner_name} · {record.location_area||'Area not updated'}</span><small>{record.status==='BUSY'?`Available again ${record.available_again_date}`:`${record.available_percent}% available`} · {record.visibility.replaceAll('_',' ')} · updated {relativeTime(record.updated_at)}</small></div><StatusPill status={record.status}/>{record.status!=='OFF_DUTY'?<form action={`/api/admin/records/capacity/${record.id}`} method="post"><input type="hidden" name="command" value="OFF_DUTY"/><input type="hidden" name="returnTo" value={returnTo}/><button className="button small danger"><Gauge aria-hidden="true"/>Off Duty</button></form>:null}</article>):null}
        {view==='NETWORK'?records.map(record=><article key={`${record.record_kind}-${record.id}`}><div><strong>{record.owner_name} · {record.target_name}</strong><span>{record.record_kind==='BUSINESS_FAVORITE'?'Business favorite':'Business and transport provider'}</span><small>{record.detail||'Relationship'} · updated {relativeTime(record.updated_at)}</small></div><StatusPill status={record.status}/><form action={`/api/admin/records/${record.record_kind.toLowerCase()}/${record.id}`} method="post"><input type="hidden" name="command" value={record.record_kind==='BUSINESS_FAVORITE'?'REMOVE':'DISCONNECT'}/><input type="hidden" name="returnTo" value={returnTo}/><button className="button small danger"><Network aria-hidden="true"/>{record.record_kind==='BUSINESS_FAVORITE'?'Remove':'Disconnect'}</button></form></article>):null}
        {view==='ROUTES'?records.map(record=><article key={`${record.record_kind}-${record.id}`}><div><strong>{record.owner_name}</strong><span>{record.record_kind==='SERVICE_AREA'?`${record.origin} · ${record.radius_km} km radius`:`${record.origin} → ${record.destination}`}</span><small>{record.record_kind==='SERVICE_AREA'?'Local service area':'Preferred Route'} · added {relativeTime(record.created_at)}</small></div><StatusPill status={record.record_kind==='SERVICE_AREA'?'LOCAL':'ROUTE'}/><form action={`/api/admin/records/${record.record_kind.toLowerCase()}/${record.id}`} method="post"><input type="hidden" name="command" value="REMOVE"/><input type="hidden" name="returnTo" value={returnTo}/><button className="button small danger"><Trash2 aria-hidden="true"/>Remove</button></form></article>):null}
        {view==='SUBSCRIPTIONS'?records.map(record=><article key={record.id}><div><strong>{record.owner_name}</strong><span>{record.plan_name} · {record.billing_model.replaceAll('_',' ')}</span><small>{record.ends_at?`Ends ${new Date(record.ends_at).toLocaleDateString()}`:'No expiry'} · updated {relativeTime(record.updated_at)}</small></div><StatusPill status={record.status}/><details className="admin-inline-actions"><summary className="button small secondary">Manage</summary><form action={`/api/admin/records/subscription/${record.id}`} method="post" className="button-row"><input type="hidden" name="returnTo" value={returnTo}/><button className="button small success" name="command" value="PAID">Paid · 30 days</button><button className="button small danger" name="command" value="EXPIRE">Expire</button>{['ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER'].includes(record.organization_type)?<button className="button small secondary" name="command" value="SPONSOR"><Gift aria-hidden="true"/>Sponsor</button>:null}</form></details></article>):null}
      </div>
      {!records.length?<div className="empty-state">No {views.find(item=>item.id===view)?.label.toLowerCase()} match this search.</div>:null}
      <Pagination path="/admin/operations" query={{q:query.q,view}} page={data.pagination.page} pageCount={data.pagination.pageCount} total={data.pagination.total}/>
    </section>
    <div className="admin-security-note"><Activity aria-hidden="true"/>Credentials, sessions, tracking secrets, exact coordinates, and private files are never shown here.</div>
  </div>;
}
