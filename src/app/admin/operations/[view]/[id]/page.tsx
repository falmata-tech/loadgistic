import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {ArrowLeft,Building2,CalendarClock,ExternalLink,Gauge,PackageSearch,Route,Save,Truck,UserRoundCog} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {getAdminOperationRecord,hasPlatformPermission,PLATFORM_PERMISSIONS} from '@/lib/platform-admin.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {StatusPill} from '@/components/status-pill';
import {relativeTime} from '@/lib/ui';

const views:Record<string,{label:string;permission:keyof typeof PLATFORM_PERMISSIONS;icon:any}>={
  USERS:{label:'User',permission:'CUSTOMERS',icon:UserRoundCog},
  WORKSPACES:{label:'Client',permission:'CUSTOMERS',icon:Building2},
  TRUCKS:{label:'Truck',permission:'OPERATIONS',icon:Truck},
  DRIVERS:{label:'Driver access',permission:'OPERATIONS',icon:UserRoundCog},
  TRACKING:{label:'Tracking',permission:'OPERATIONS',icon:PackageSearch},
  CAPACITY:{label:'Capacity',permission:'OPERATIONS',icon:Gauge},
  ROUTES:{label:'Regular service',permission:'OPERATIONS',icon:Route},
  SUBSCRIPTIONS:{label:'Plan',permission:'BILLING',icon:CalendarClock}
};

function text(value:any,fallback='Not recorded'){return value===null||value===undefined||value===''?fallback:String(value);}
function date(value:any){return value?new Date(value).toLocaleString():'Not recorded';}
function titleFor(record:any){
  if(record.view==='USERS')return record.name;
  if(record.view==='WORKSPACES')return record.name;
  if(record.view==='TRUCKS')return `${record.platform_number} · ${record.make} ${record.model}`;
  if(record.view==='DRIVERS')return record.name;
  if(record.view==='TRACKING')return `Tracking · ${record.code}`;
  if(record.view==='CAPACITY')return `${record.platform_number} · ${record.status}`;
  if(record.view==='ROUTES')return record.owner_name;
  return record.owner_name||record.plan_name;
}
function statusFor(record:any){
  return record.operational_status
    ||record.capacity_status
    ||record.subscription_status
    ||record.status
    ||(typeof record.active==='boolean'?(record.active?'ACTIVE':'SUSPENDED'):record.record_kind||'RECORDED');
}

function factsFor(record:any){
  if(record.view==='USERS')return [['Email',record.email],['Phone',record.phone],['Role',record.role?.replaceAll('_',' ')],['Workspace',record.workspace_name],['Created',date(record.created_at)]];
  if(record.view==='WORKSPACES')return [['Type',record.type?.replaceAll('_',' ')],['City',record.city],['Public handle',record.handle?`@${record.handle}`:null],['Users',record.user_count],['Active trucks',record.active_truck_count],['All trucks',record.truck_count],['Tracking sessions',record.tracking_count],['Plan',record.subscription_status]];
  if(record.view==='TRUCKS')return [['Owner',record.owner_name],['Cargo configuration',record.cargo_configuration],['Plate',record.plate],['Assigned Driver',record.driver_name],['Capacity',record.capacity_status],['Visibility',record.capacity_visibility],['Reported area',record.location_area],['Capacity updated',date(record.capacity_updated_at)],['Location updated',date(record.location_updated_at)]];
  if(record.view==='DRIVERS')return [['Email',record.email],['Phone',record.phone],['Fleet transporter',record.owner_name],['Assigned truck',record.platform_number],['Capacity updates',record.can_manage_capacity?'Allowed':'Not allowed'],['Tracking updates',record.can_manage_tracking?'Allowed':'Not allowed']];
  if(record.view==='TRACKING')return [['Cargo',record.cargo_summary],['Route',`${record.origin} → ${record.destination}`],['Transporter',record.provider_name],['Truck',record.platform_number],['Driver',record.driver_name],['Tracking mode',record.tracking_mode?.replaceAll('_',' ')],['Expected pickup',record.expected_pickup_date],['Expected delivery',record.expected_delivery_date],['Updated',date(record.updated_at)]];
  if(record.view==='CAPACITY')return [['Transporter',record.owner_name],['Truck',`${record.platform_number} · ${record.make} ${record.model}`],['Visibility',record.visibility?.replaceAll('_',' ')],['Signal type',record.availability_geometry==='RADIUS'?'Service area':'Capacity route'],['Reported area',record.location_area],['Capacity updated',date(record.updated_at)],['Location updated',date(record.location_updated_at)]];
  if(record.view==='ROUTES')return [['Transporter',record.owner_name],['Type',record.record_kind==='SERVICE_AREA'?'Service area':'Capacity route'],['Geometry',record.geometry==='RADIUS'?'Area':'Route'],['Service',record.record_kind==='SERVICE_AREA'?`${record.origin} · ${record.radius_km} km`:`${record.origin} → ${record.destination}`],['Added',date(record.created_at)]];
  return [['Owner',record.owner_name],['Plan',record.plan_name],['Billing',record.billing_model?.replaceAll('_',' ')],['Starts',date(record.starts_at)],['Ends',date(record.ends_at)],['Updated',date(record.updated_at)]];
}

function RecordActions({record,returnTo,actorId}:{record:any;returnTo:string;actorId:string}){
  if(record.view==='USERS')return <form action={`/api/admin/records/user/${record.id}`} method="post"><input type="hidden" name="returnTo" value={returnTo}/>{!record.active?<input type="hidden" name="active" value="on"/>:null}<button className={`button ${record.active?'danger':'success'}`} disabled={record.id===actorId} title={record.id===actorId?'Administrators cannot suspend their own account.':undefined}>{record.id===actorId?'Current account':record.active?'Suspend account':'Restore account'}</button></form>;
  if(record.view==='TRUCKS')return <form action={`/api/admin/records/vehicle/${record.id}`} method="post"><input type="hidden" name="returnTo" value={returnTo}/>{!record.active?<input type="hidden" name="active" value="on"/>:null}<button className={`button ${record.active?'danger':'success'}`}>{record.active?'Deactivate truck':'Reactivate truck'}</button></form>;
  if(record.view==='DRIVERS')return <div className="admin-record-action-stack"><form action={`/api/admin/records/driver_permissions/${record.id}`} method="post" className="admin-record-permissions"><input type="hidden" name="returnTo" value={returnTo}/><label><input name="canManageCapacity" type="checkbox" defaultChecked={Boolean(record.can_manage_capacity)}/>Capacity updates</label><label><input name="canManageTracking" type="checkbox" defaultChecked={Boolean(record.can_manage_tracking)}/>Tracking updates</label><button className="button"><Save aria-hidden="true"/>Save permissions</button></form><form action={`/api/admin/records/driver/${record.id}`} method="post"><input type="hidden" name="returnTo" value={returnTo}/>{!record.active?<input type="hidden" name="active" value="on"/>:null}<button className={`button ${record.active?'danger':'success'}`}>{record.active?'Suspend Driver':'Restore Driver'}</button></form></div>;
  if(record.view==='CAPACITY'&&record.status!=='OFF_DUTY')return <form action={`/api/admin/records/capacity/${record.id}`} method="post"><input type="hidden" name="returnTo" value={returnTo}/><button className="button danger" name="command" value="OFF_DUTY">Set Off Duty</button></form>;
  if(record.view==='ROUTES')return <form action={`/api/admin/records/${String(record.record_kind).toLowerCase()}/${record.id}`} method="post"><input type="hidden" name="returnTo" value={`/admin/operations?view=ROUTES`}/><button className="button danger" name="command" value="REMOVE">Remove regular service</button></form>;
  if(record.view==='SUBSCRIPTIONS')return <form action={`/api/admin/records/subscription/${record.id}`} method="post" className="button-row"><input type="hidden" name="returnTo" value={returnTo}/><button className="button success" name="command" value="PAID">Paid · 30 days</button><button className="button danger" name="command" value="EXPIRE">Expire</button></form>;
  return null;
}

export default async function AdminOperationRecordPage({params,searchParams}:{params:Promise<{view:string;id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['ADMIN','SUPPORT'],{allowLimited:true});
  const {view:rawView,id}=await params;const query=await searchParams;const view=rawView.toUpperCase();const config=views[view];
  if(!config)notFound();
  if(!hasPlatformPermission(user,PLATFORM_PERMISSIONS[config.permission]))redirect('/admin/operations');
  const record:any=await getAdminOperationRecord(user,view,id,query.kind||'');
  if(!record)notFound();
  const Icon=config.icon;const listHref=`/admin/operations?view=${view}`;const returnTo=`/admin/operations/${view.toLowerCase()}/${record.id}${record.record_kind?`?kind=${record.record_kind}`:''}`;
  const events=Array.isArray(record.events)?record.events:[];
  const actions=RecordActions({record,returnTo,actorId:user.id});
  return <div className="page admin-operation-record-page">
    <PageHeader icon={Icon} title={titleFor(record)} subtitle={`${config.label} record`} action={<Link className="button secondary small" href={listHref}><ArrowLeft aria-hidden="true"/>{config.label} list</Link>}/>
    <Flash error={query.error} success={query.success}/>
    <section className="admin-operation-record-card">
      <header><div><span className="section-kicker">{config.label}</span><h2>Record details</h2></div><StatusPill status={statusFor(record)}/></header>
      <dl>{factsFor(record).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{text(value)}</dd></div>)}</dl>
      <div className="admin-record-links">
        {record.provider_handle?<Link className="button secondary" href={`/@${record.provider_handle}`}><ExternalLink aria-hidden="true"/>Public transporter</Link>:null}
        {record.vehicle_id&&view!=='TRUCKS'?<Link className="button secondary" href={`/admin/operations/trucks/${record.vehicle_id}`}><Truck aria-hidden="true"/>Open truck</Link>:null}
        {record.workspace_id?<Link className="button secondary" href={`/admin/operations/workspaces/${record.workspace_id}?kind=${record.workspace_kind}`}><Building2 aria-hidden="true"/>Open workspace</Link>:null}
        {record.owner_id?<Link className="button secondary" href={`/admin/operations/workspaces/${record.owner_id}?kind=${record.owner_kind}`}><Building2 aria-hidden="true"/>Open owner</Link>:null}
      </div>
    </section>
    {view==='TRACKING'?<section className="admin-operation-timeline"><h2><CalendarClock aria-hidden="true"/>Status timeline</h2>{events.length?<ol>{events.map((event:any)=><li key={event.id}><span/><div><strong>{String(event.status).replaceAll('_',' ')}</strong><p>{event.note||'Status updated'}</p><small>{date(event.created_at)}{event.has_proof?' · Proof recorded':''}</small></div></li>)}</ol>:<div className="empty-state">No status events recorded.</div>}</section>:null}
    <aside className="admin-operation-actions"><h2>Management</h2>{actions||<p>This record is read-only. Its related records and history remain available for investigation.</p>}</aside>
  </div>;
}
