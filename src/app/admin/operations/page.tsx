import Link from 'next/link';
import { Activity, Building2, Gauge, PackageSearch, Search, Truck, Users } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAdminOperations } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { relativeTime } from '@/lib/ui';
import { Pagination } from '@/components/pagination';

const views=[
  {id:'WORKSPACES',label:'Clients',icon:Building2},
  {id:'USERS',label:'Users',icon:Users},
  {id:'TRUCKS',label:'Trucks',icon:Truck},
  {id:'LOADS',label:'Loads',icon:PackageSearch},
  {id:'CAPACITY',label:'Capacity',icon:Gauge}
] as const;

function workspaceTypeLabel(type:string){
  if(['ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER'].includes(type))return 'Business';
  if(type==='TRANSPORT_COMPANY')return 'Fleet transporter';
  if(type==='SELF_MANAGED_DRIVER')return 'Self-managed driver';
  return type.replaceAll('_',' ').toLowerCase();
}

export default async function AdminOperationsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['ADMIN']);
  const query=await searchParams;
  const requested=String(query.view||'WORKSPACES').toUpperCase();
  const view=views.some(item=>item.id===requested)?requested:'WORKSPACES';
  const data:any=getAdminOperations(user,query.q||'',{...query,view});
  const records:any[]=data.items;

  return <div className="page admin-operations">
    <PageHeader title="Platform Operations" subtitle="Find and manage one connected record type at a time."/>
    <Flash error={query.error} success={query.success}/>
    <section className="stats compact-admin-stats">
      <div className="stat"><span className="meta">Clients</span><strong>{data.counts.workspaces}</strong></div>
      <div className="stat"><span className="meta">Users</span><strong>{data.counts.users}</strong></div>
      <div className="stat"><span className="meta">Trucks</span><strong>{data.counts.trucks}</strong></div>
      <div className="stat"><span className="meta">Loads</span><strong>{data.counts.loads}</strong></div>
      <div className="stat"><span className="meta">On Board</span><strong>{data.counts.board_capacity}</strong></div>
    </section>
    <nav className="admin-view-tabs" aria-label="Platform record type">
      {views.map(item=>{const Icon=item.icon;return <Link key={item.id} className={view===item.id?'active':''} href={`/admin/operations?view=${item.id}${query.q?`&q=${encodeURIComponent(query.q)}`:''}`}><Icon aria-hidden="true"/>{item.label}</Link>;})}
    </nav>
    <form className="board-filter-bar" method="get">
      <input type="hidden" name="view" value={view}/>
      <div className="form-group"><label htmlFor="operations-search"><Search aria-hidden="true"/>Search {views.find(item=>item.id===view)?.label}</label><input id="operations-search" name="q" defaultValue={query.q||''} placeholder="Name, account, truck number, or load code"/></div>
      <button className="button icon-button-label"><Search aria-hidden="true"/>Search</button>
      {data.query?<Link href={`/admin/operations?view=${view}`} className="button secondary">Clear</Link>:null}
    </form>

    <section className="admin-record-section">
      <div className="admin-record-list">
        {view==='USERS'?records.map(record=><article key={record.id}><div><strong>{record.name}</strong><span>{record.email} · {record.phone||'Phone not added'}</span><small>{record.workspace_name} · {record.role.replaceAll('_',' ')}</small></div><StatusPill status={record.active?'ACTIVE':'SUSPENDED'}/><form action={`/api/admin/records/user/${record.id}`} method="post">{!record.active?<input type="hidden" name="active" value="on"/>:null}<button className={`button small icon-button-label ${record.active?'danger':'success'}`} disabled={record.id===user.id}>{record.active?'Suspend':'Restore'}</button></form></article>):null}
        {view==='WORKSPACES'?records.map(record=><article key={`${record.record_kind}-${record.id}`}><div><strong>{record.name}</strong><span>{workspaceTypeLabel(record.type)} · {record.city||'Location not added'}</span><small>{record.user_count} users · {record.truck_count} active trucks · {record.load_count} loads</small></div><StatusPill status={record.public_visibility}/></article>):null}
        {view==='TRUCKS'?records.map(record=><article key={record.id}><div><strong>{record.platform_number} · {record.make} {record.model}</strong><span>{record.owner_name} · {record.cargo_configuration} · plate {record.plate||'not recorded'}</span><small>{record.capacity_status?`${record.capacity_status.replaceAll('_',' ')} · ${record.location_area||'Area not updated'} · ${relativeTime(record.capacity_updated_at)}`:'No capacity update'}</small></div><StatusPill status={record.active?'ACTIVE':'INACTIVE'}/><form action={`/api/admin/records/vehicle/${record.id}`} method="post">{!record.active?<input type="hidden" name="active" value="on"/>:null}<button className={`button small icon-button-label ${record.active?'danger':'success'}`}>{record.active?'Deactivate':'Reactivate'}</button></form></article>):null}
        {view==='LOADS'?records.map(record=><article key={record.id}><div><strong>{record.code} · {record.title}</strong><span>{record.origin} → {record.destination}</span><small>Owner: {record.owner_name} · Provider: {record.provider_name||'Not assigned'} · Updated {relativeTime(record.updated_at)}</small></div><StatusPill status={record.operational_status}/><Link className="button secondary small" href={`/app/shipments/${record.id}`}><PackageSearch aria-hidden="true"/>Open</Link></article>):null}
        {view==='CAPACITY'?records.map(record=><article key={record.id}><div><strong>{record.platform_number} · {record.make} {record.model}</strong><span>{record.owner_name} · {record.location_area||'Area not updated'}</span><small>{record.status==='BUSY'?`Available again ${record.available_again_date}`:`${record.available_percent}% available`} · {record.visibility.replaceAll('_',' ')} · updated {relativeTime(record.updated_at)}</small></div><StatusPill status={record.status}/></article>):null}
      </div>
      {!records.length?<div className="empty-state">No {views.find(item=>item.id===view)?.label.toLowerCase()} match this search.</div>:null}
      <Pagination path="/admin/operations" query={{q:query.q,view}} page={data.pagination.page} pageCount={data.pagination.pageCount} total={data.pagination.total}/>
    </section>
    <div className="admin-security-note"><Activity aria-hidden="true"/>Credentials, sessions, tracking secrets, exact coordinates, and private files are never shown here.</div>
  </div>;
}
