import Link from 'next/link';
import { Activity, Building2, Gauge, PackageSearch, Search, Truck, Users } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAdminOperations } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { relativeTime } from '@/lib/ui';

export default async function AdminOperationsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser(['ADMIN']);
  const query=await searchParams;
  const data:any=getAdminOperations(user,query.q||'');
  return <div className="page admin-operations">
    <PageHeader title="Platform Operations" subtitle="Inspect connected Loadgistic records and control account or truck availability."/>
    <Flash error={query.error} success={query.success}/>
    <form className="board-filter-bar" method="get">
      <div className="form-group"><label htmlFor="operations-search"><Search aria-hidden="true"/>Search platform records</label><input id="operations-search" name="q" defaultValue={query.q||''} placeholder="Name, email, truck number, load code, city, or status"/></div>
      <button className="button icon-button-label"><Search aria-hidden="true"/>Search</button>
      {data.query?<Link href="/admin/operations" className="button secondary">Clear</Link>:null}
    </form>
    <section className="stats">
      <div className="stat"><span className="meta">Users</span><strong>{data.counts.users}</strong></div>
      <div className="stat"><span className="meta">Workspaces</span><strong>{data.counts.workspaces}</strong></div>
      <div className="stat"><span className="meta">Trucks</span><strong>{data.counts.trucks}</strong></div>
      <div className="stat"><span className="meta">Loads</span><strong>{data.counts.loads}</strong></div>
      <div className="stat"><span className="meta">Fresh capacity</span><strong>{data.counts.fresh_capacity}</strong></div>
    </section>
    <nav className="operations-jump" aria-label="Operations record groups">
      <a href="#users"><Users aria-hidden="true"/>Users</a>
      <a href="#workspaces"><Building2 aria-hidden="true"/>Workspaces</a>
      <a href="#trucks"><Truck aria-hidden="true"/>Trucks</a>
      <a href="#loads"><PackageSearch aria-hidden="true"/>Loads</a>
      <a href="#capacity"><Gauge aria-hidden="true"/>Capacity</a>
    </nav>

    <section className="admin-record-section" id="users"><div className="section-heading-icon"><Users aria-hidden="true"/><div><h2>Users</h2><p className="meta">Login access and workspace membership. Private password and session data are never shown.</p></div></div><div className="admin-record-list">{data.users.map((record:any)=><article key={record.id}><div><strong>{record.name}</strong><span>{record.email} · {record.phone||'Phone not added'}</span><small>{record.workspace_name} · {record.role.replaceAll('_',' ')}</small></div><StatusPill status={record.active?'ACTIVE':'SUSPENDED'}/><form action={`/api/admin/records/user/${record.id}`} method="post">{!record.active?<input type="hidden" name="active" value="on"/>:null}<button className={`button small icon-button-label ${record.active?'danger':'success'}`} disabled={record.id===user.id}>{record.active?'Suspend':'Restore'}</button></form></article>)}</div>{!data.users.length?<div className="empty-state">No users match this search.</div>:null}</section>

    <section className="admin-record-section" id="workspaces"><div className="section-heading-icon"><Building2 aria-hidden="true"/><div><h2>Workspaces</h2><p className="meta">Authoritative organization and self-managed provider records.</p></div></div><div className="admin-record-list">{data.workspaces.map((record:any)=><article key={`${record.record_kind}-${record.id}`}><div><strong>{record.name}</strong><span>{record.type.replaceAll('_',' ')} · {record.city||'Location not added'}</span><small>{record.user_count} users · {record.truck_count} active trucks · {record.load_count} loads</small></div><StatusPill status={record.public_visibility}/></article>)}</div>{!data.workspaces.length?<div className="empty-state">No workspaces match this search.</div>:null}</section>

    <section className="admin-record-section" id="trucks"><div className="section-heading-icon"><Truck aria-hidden="true"/><div><h2>Trucks</h2><p className="meta">Permanent platform identity, owner, private operational plate, and latest capacity.</p></div></div><div className="admin-record-list">{data.vehicles.map((record:any)=><article key={record.id}><div><strong>{record.platform_number} · {record.make} {record.model}</strong><span>{record.owner_name} · {record.cargo_configuration} · plate {record.plate||'not recorded'}</span><small>{record.capacity_status?`${record.capacity_status.replaceAll('_',' ')} · ${record.location_area||'Area not updated'} · ${relativeTime(record.capacity_updated_at)}`:'No capacity update'}</small></div><StatusPill status={record.active?'ACTIVE':'INACTIVE'}/><form action={`/api/admin/records/vehicle/${record.id}`} method="post">{!record.active?<input type="hidden" name="active" value="on"/>:null}<button className={`button small icon-button-label ${record.active?'danger':'success'}`}>{record.active?'Deactivate':'Reactivate'}</button></form></article>)}</div>{!data.vehicles.length?<div className="empty-state">No trucks match this search.</div>:null}</section>

    <section className="admin-record-section" id="loads"><div className="section-heading-icon"><PackageSearch aria-hidden="true"/><div><h2>Loads</h2><p className="meta">Demand ownership, assignment, route, and current workflow stage.</p></div></div><div className="admin-record-list">{data.loads.map((record:any)=><article key={record.id}><div><strong>{record.code} · {record.title}</strong><span>{record.origin} → {record.destination}</span><small>Owner: {record.owner_name} · Provider: {record.provider_name||'Not assigned'} · Updated {relativeTime(record.updated_at)}</small></div><StatusPill status={record.operational_status}/><Link className="button secondary small" href={`/app/shipments/${record.id}`}>Open</Link></article>)}</div>{!data.loads.length?<div className="empty-state">No loads match this search.</div>:null}</section>

    <section className="admin-record-section" id="capacity"><div className="section-heading-icon"><Activity aria-hidden="true"/><div><h2>Latest truck capacity</h2><p className="meta">One latest record per truck. Exact coordinates and private proof paths are excluded.</p></div></div><div className="admin-record-list">{data.capacities.map((record:any)=><article key={record.id}><div><strong>{record.platform_number} · {record.make} {record.model}</strong><span>{record.owner_name} · {record.location_area||'Area not updated'}</span><small>{record.available_percent}% available · {record.visibility.replaceAll('_',' ')} · expires {new Date(record.expires_at).toLocaleString()}</small></div><StatusPill status={record.status}/></article>)}</div>{!data.capacities.length?<div className="empty-state">No capacity records match this search.</div>:null}</section>
  </div>;
}
