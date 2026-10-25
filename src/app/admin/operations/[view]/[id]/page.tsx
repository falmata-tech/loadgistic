import styles from '@/app/admin/admin-presentation.module.css';

import {listProviderTrackingAppeals} from '@/lib/provider-tracking.js';
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import {getTrackingRecovery,adminTrackingLocation} from '@/lib/lifecycle.js';
import {TrackingRecoveryControls} from '@/components/lifecycle-controls';
import {TrackingLocationMap} from '@/components/tracking-location-map';
import {trackingMapData} from '@/components/tracking-map-data';
import {TrackingProofLink} from '@/components/tracking-proof-link';
import {DemoTrackingLabel} from '@/components/demo-tracking-label';
import {isDemoTrackingShipment} from '@/lib/demo-tracking-identity.js';
import {notFound,redirect} from 'next/navigation';
import {ArrowLeft,Building2,CalendarClock,ExternalLink,Gauge,PackageSearch,Route,Save,Truck,UserRoundCog} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {getAdminOperationRecord,hasPlatformPermission,PLATFORM_PERMISSIONS} from '@/lib/platform-admin.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {StatusPill} from '@/components/status-pill';
import {displayStatus} from '@/lib/ui';
import {WorkspaceTaskDialog} from '@/components/workspace-task-dialog';
import {AdminRecordDocuments} from '@/components/admin-record-documents';
import {getAdminAccountOverview,getAdminRecordDocuments} from '@/lib/platform-admin/account';
import {adminAccountReturnPath,adminOperationListReturnPath} from '@/lib/admin-account-navigation.js';
import {AdminAccountOverviewView} from '@/components/admin-account-overview';

const views:Record<string,{label:string;permission:keyof typeof PLATFORM_PERMISSIONS;icon:any}>={
  USERS:{label:'User',permission:'CUSTOMERS',icon:UserRoundCog},
  WORKSPACES:{label:'Client',permission:'CUSTOMERS',icon:Building2},
  TRUCKS:{label:'Vehicle',permission:'OPERATIONS',icon:Truck},
  DRIVERS:{label:'Driver access',permission:'OPERATIONS',icon:UserRoundCog},
  TRACKING:{label:'Tracking',permission:'OPERATIONS',icon:PackageSearch},
  CAPACITY:{label:'Capacity',permission:'OPERATIONS',icon:Gauge},
  ROUTES:{label:'Regular service',permission:'OPERATIONS',icon:Route},
};

function text(value:any,fallback='Not recorded'){return value===null||value===undefined||value===''?fallback:String(value);}
function date(value:any){return value?new Date(value).toLocaleString():'Not recorded';}
function titleFor(record:any){
  if(record.view==='USERS')return record.name;
  if(record.view==='WORKSPACES')return record.name;
  if(record.view==='TRUCKS')return `${record.platform_number} · ${record.make} ${record.model}`;
  if(record.view==='DRIVERS')return record.name;
  if(record.view==='TRACKING')return <><Text message="Tracking"/> · {record.code}</>;
  if(record.view==='CAPACITY')return <>{record.platform_number} · <Text message={displayStatus(record.status)}/></>;
  if(record.view==='ROUTES')return record.owner_name;
  return record.owner_name;
}
function statusFor(record:any){
  if(record.view==='ROUTES')return record.geometry==='RADIUS'?'SERVICE_AREA':'ROUTE';
  return record.operational_status
    ||record.capacity_status
    ||record.status
    ||(typeof record.active==='boolean'?(record.active?'ACTIVE':'SUSPENDED'):record.record_kind||'RECORDED');
}

function factsFor(record:any){
  if(record.view==='USERS')return [['Email',record.email],['Phone',record.phone],['Role',displayStatus(record.role)],['Workspace',record.workspace_name],['Created',date(record.created_at)]];
  if(record.view==='WORKSPACES')return [['Type',['OWNER_OPERATOR','SELF_MANAGED_DRIVER','INDEPENDENT_PROVIDER'].includes(record.type)?'Transport Provider':record.type==='TRANSPORT_COMPANY'?'Transport Provider':record.type==='ENTERPRISE_SHIPPER'?'Shipper / broker workspace':record.type==='ENTERPRISE_RECEIVER'?'Receiver workspace':displayStatus(record.type)],['City',record.city],['Public handle',record.handle?`@${record.handle}`:null],['Users',record.user_count],['Active vehicles',record.active_truck_count],['All vehicles',record.truck_count],['Tracking sessions',record.tracking_count]];
  if(record.view==='TRUCKS')return [['Owner',record.owner_name],['Cargo configuration',record.cargo_configuration],['Plate',record.plate],['Assigned Driver',record.driver_name],['Capacity',displayStatus(record.capacity_status)],['Visibility',record.capacity_visibility==='PRIVATE_NETWORK'?'Private capacity':displayStatus(record.capacity_visibility)],['Reported area',record.location_area],['Capacity updated',date(record.capacity_updated_at)],['Location updated',date(record.location_updated_at)]];
  if(record.view==='DRIVERS')return [['Email',record.email],['Phone',record.phone],['Fleet transporter',record.owner_name],['Assigned vehicle',record.platform_number],['Capacity updates',record.can_manage_capacity?'Allowed':'Not allowed'],['Tracking updates',record.can_manage_tracking?'Allowed':'Not allowed']];
  if(record.view==='TRACKING')return [['Cargo',record.cargo_summary],['Route',`${record.origin} → ${record.destination}`],['Transporter',record.provider_name],['Vehicle',record.platform_number],['Driver',record.driver_name],['Tracking mode',displayStatus(record.tracking_mode)],['Expected pickup',record.expected_pickup_date],['Expected delivery',record.expected_delivery_date],['Updated',date(record.updated_at)]];
  if(record.view==='CAPACITY')return [['Transporter',record.owner_name],['Vehicle',`${record.platform_number} · ${record.make} ${record.model}`],['Visibility',record.visibility==='PRIVATE_NETWORK'?'Private capacity':displayStatus(record.visibility)],['Signal type',record.availability_geometry==='RADIUS'?'Service area':'Capacity route'],['Reported area',record.location_area],['Capacity updated',date(record.updated_at)],['Location updated',date(record.location_updated_at)]];
  if(record.view==='ROUTES')return [['Transporter',record.owner_name],['Type',record.geometry==='RADIUS'?'Service area':'Corridor route'],['Geometry',record.geometry==='RADIUS'?'Area':'Route'],['Service',record.geometry==='RADIUS'?`Area around ${record.origin}`:`${record.origin} → ${record.destination}`],['Added',date(record.created_at)]];
  return [];
}

function RecordActions({record,returnTo,actorId,actorIsAdmin=false}:{record:any;returnTo:string;actorId:string;actorIsAdmin?:boolean}){
  if(record.view==='WORKSPACES')return <WorkspaceTaskDialog title="Edit account name" triggerLabel="Edit account name"><form className="stack" action={`/api/admin/workspaces/${record.id}/details`} method="post"><input type="hidden" name="kind" value={record.record_kind}/><input type="hidden" name="previous_name" value={record.name}/><input type="hidden" name="returnTo" value={returnTo}/><label><Text message="Account name"/><input name="name" defaultValue={record.name} minLength={2} maxLength={120} required/></label><label><Text message="Reason"/><textarea name="reason" minLength={5} maxLength={500} required/></label><button className="button secondary"><Text message="Save account name"/></button></form></WorkspaceTaskDialog>;
  if(record.view==='USERS'&&record.id!==actorId&&!actorIsAdmin&&['ADMIN','SUPPORT'].includes(record.role))return <span className="meta"><Text message="Read-only"/></span>;
  if(record.view==='USERS')return <>{actorIsAdmin&&record.role==='SUPPORT'?<Link className="button secondary small" href="/admin/support?tab=team"><Text message="Platform team"/></Link>:null}<WorkspaceTaskDialog title={record.active?'Suspend account':'Restore account'} triggerLabel={record.id===actorId?'Current account':record.active?'Suspend account':'Restore account'} disabled={record.id===actorId} variant={record.active?'danger':'default'}><form action={`/api/admin/records/user/${record.id}`} method="post"><input type="hidden" name="returnTo" value={returnTo}/>{!record.active?<input type="hidden" name="active" value="on"/>:null}<Localized as="button" copy={['title']} className={`button ${record.active?'danger':'success'}`} disabled={record.id===actorId} title={record.id===actorId?'Administrators cannot suspend their own account.':undefined}>{record.id===actorId?<Text message="Current account"/>:record.active?<Text message="Suspend account"/>:<Text message="Restore account"/>}</Localized></form></WorkspaceTaskDialog></>;
  if(record.view==='TRUCKS')return <WorkspaceTaskDialog title={record.active?'Deactivate vehicle':'Reactivate vehicle'} triggerLabel={record.active?'Deactivate vehicle':'Reactivate vehicle'} variant={record.active?'danger':'default'}><form action={`/api/admin/records/vehicle/${record.id}`} method="post"><input type="hidden" name="returnTo" value={returnTo}/>{!record.active?<input type="hidden" name="active" value="on"/>:null}<button className={`button ${record.active?'danger':'success'}`}>{record.active?<Text message="Deactivate vehicle"/>:<Text message="Reactivate vehicle"/>}</button></form></WorkspaceTaskDialog>;
  if(record.view==='DRIVERS')return <div className={styles.recordActions}><WorkspaceTaskDialog title="Driver permissions" triggerLabel="Edit permissions"><form action={`/api/admin/records/driver_permissions/${record.id}`} method="post" className="admin-record-permissions"><input type="hidden" name="returnTo" value={returnTo}/><label><input name="canManageCapacity" type="checkbox" defaultChecked={Boolean(record.can_manage_capacity)}/><Text message="Capacity updates"/></label><label><input name="canManageTracking" type="checkbox" defaultChecked={Boolean(record.can_manage_tracking)}/><Text message="Tracking updates"/></label><button className="button"><Save aria-hidden="true"/><Text message="Save permissions"/></button></form></WorkspaceTaskDialog><WorkspaceTaskDialog title={record.active?'Suspend Driver':'Restore Driver'} triggerLabel={record.active?'Suspend Driver':'Restore Driver'} variant={record.active?'danger':'default'}><form action={`/api/admin/records/driver/${record.id}`} method="post"><input type="hidden" name="returnTo" value={returnTo}/>{!record.active?<input type="hidden" name="active" value="on"/>:null}<button className={`button ${record.active?'danger':'success'}`}>{record.active?<Text message="Suspend Driver"/>:<Text message="Restore Driver"/>}</button></form></WorkspaceTaskDialog></div>;
  if(record.view==='CAPACITY'&&record.status!=='OFF_DUTY')return <WorkspaceTaskDialog title="Set Off Duty" triggerLabel="Set Off Duty" variant="danger"><form action={`/api/admin/records/capacity/${record.id}`} method="post"><input type="hidden" name="returnTo" value={returnTo}/><button className="button danger" name="command" value="OFF_DUTY"><Text message="Set Off Duty"/></button></form></WorkspaceTaskDialog>;
  if(record.view==='ROUTES')return <WorkspaceTaskDialog title="Remove regular service" triggerLabel="Remove regular service" variant="danger"><form action={`/api/admin/records/${String(record.record_kind).toLowerCase()}/${record.id}`} method="post"><input type="hidden" name="returnTo" value={`/admin/operations?view=ROUTES`}/><button className="button danger" name="command" value="REMOVE"><Text message="Remove regular service"/></button></form></WorkspaceTaskDialog>;
  return null;
}

export default async function AdminOperationRecordPage({params,searchParams}:{params:Promise<{view:string;id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['ADMIN','SUPPORT'],{allowLimited:true});
  const {view:rawView,id}=await params;const query=await searchParams;const view=rawView.toUpperCase();const config=views[view];
  if(!config)notFound();
  if(!hasPlatformPermission(user,PLATFORM_PERMISSIONS[config.permission]))redirect('/admin/operations');
  if(view==='USERS'){
    const account=await getAdminAccountOverview(user,id,{providerKey:query.provider,truckPage:query.truckPage,trackingPage:query.trackingPage,documentPage:query.documentPage,supportPage:query.supportPage,devicePage:query.devicePage}).catch((error:unknown)=>{if(error instanceof Error&&error.message==='ACCOUNT_PROVIDER_NOT_RELATED')notFound();throw error;});
    if(!account)notFound();
    const listReturn=adminOperationListReturnPath(query.returnTo,'USERS');
    const returnTo=listReturn||`/admin/operations/users/${account.account.id}`;
    const accountActions=RecordActions({record:{...account.account,view:'USERS'},returnTo,actorId:user.id,actorIsAdmin:account.actorIsAdmin});
    return <div className={"page admin-operation-record-page "+styles.workspace}><Flash error={query.error} success={query.success}/><AdminAccountOverviewView data={account} actions={accountActions} backHref={listReturn||'/admin/operations?view=USERS'}/></div>;
  }
  const record:any=await getAdminOperationRecord(user,view,id,query.kind||'');
  if(!record)notFound();
  const Icon=config.icon,accountReturn=adminAccountReturnPath(query.returnTo),inventoryReturn=adminOperationListReturnPath(query.returnTo,view),listHref=accountReturn||inventoryReturn||`/admin/operations?view=${view}`;
  const detailParams=new URLSearchParams();if(record.record_kind)detailParams.set('kind',record.record_kind);if(accountReturn)detailParams.set('returnTo',accountReturn);
  const returnTo=inventoryReturn||`/admin/operations/${view.toLowerCase()}/${record.id}${detailParams.size?'?'+detailParams:''}`;
  const relatedHref=(path:string)=>path+(accountReturn?(path.includes('?')?'&':'?')+new URLSearchParams({returnTo:accountReturn}):'');
  const events=Array.isArray(record.events)?record.events:[];
  // The bounded Driver projection joins exactly its employing organization.
  const ownerKind=record.owner_kind||(view==='DRIVERS'?'ORGANIZATION':'');
  const actions=RecordActions({record,returnTo,actorId:user.id});
  const recovery=view==='TRACKING'?await getTrackingRecovery(user,id):null;
  const appeals=view==='TRACKING'?await listProviderTrackingAppeals(user,id):[];
  const trackingMap=view==='TRACKING'?await adminTrackingLocation(user,id):null;
  const documents=view==='TRUCKS'||view==='WORKSPACES'?await getAdminRecordDocuments(user,view,id,record.record_kind||'',query.documentPage):null;
  return <div className={"page admin-operation-record-page "+styles.workspace}>
    <PageHeader icon={Icon} title={titleFor(record)} action={<Link className="button secondary small" href={listHref}><ArrowLeft aria-hidden="true"/>{accountReturn?<Text message="Account"/>:<>{config.label}<Text message=" list"/></>}</Link>}/>
    {view==='TRACKING'&&isDemoTrackingShipment(id)?<DemoTrackingLabel/>:null}
    <Flash error={query.error} success={query.success}/>
    <section className="admin-operation-record-card">
      <header><div><h2><Text message="Record details"/></h2></div><StatusPill status={statusFor(record)}/></header>
      <dl>{factsFor(record).map(([label,value])=><div key={label}><dt><Text message={label}/></dt><dd>{['Role','Type','Capacity','Visibility','Tracking mode'].includes(label)?<Text message={text(value)}/>:text(value)}</dd></div>)}</dl>
      <div className="admin-record-links">
        {record.provider_handle?<Link className="button secondary" href={`/@${record.provider_handle}`}><ExternalLink aria-hidden="true"/><Text message="Public transporter"/></Link>:null}
        {record.vehicle_id&&view!=='TRUCKS'?<Link className="button secondary" href={relatedHref(`/admin/operations/trucks/${record.vehicle_id}`)}><Truck aria-hidden="true"/><Text message="Open vehicle"/></Link>:null}
        {record.workspace_id?<Link className="button secondary" href={relatedHref(`/admin/operations/workspaces/${record.workspace_id}?kind=${record.workspace_kind}`)}><Building2 aria-hidden="true"/><Text message="Open workspace"/></Link>:null}
        {record.owner_id?<Link className="button secondary" href={relatedHref(`/admin/operations/workspaces/${record.owner_id}?kind=${ownerKind}`)}><Building2 aria-hidden="true"/><Text message="Open owner"/></Link>:null}
      </div>
    </section>
    {documents?<AdminRecordDocuments data={documents} title={view==='TRUCKS'?'Vehicle documents':'Provider documents'} path={`/admin/operations/${view.toLowerCase()}/${id}`} query={{kind:record.record_kind||undefined,returnTo:accountReturn||undefined}} returnTo={returnTo}/>:null}
    {view==='TRACKING'?<section className="admin-operation-timeline"><h2><CalendarClock aria-hidden="true"/><Text message="Status timeline"/></h2>{events.length?<ol>{events.map((event:any)=><li key={event.id}><span/><div><strong><Text message={displayStatus(event.status)}/></strong>{isDemoTrackingShipment(id)?<DemoTrackingLabel kind="event"/>:null}<p>{event.note||'Status updated'}</p><small>{date(event.created_at)}</small>{event.has_proof?<TrackingProofLink shipmentId={id} eventId={event.id}/>:null}</div></li>)}</ol>:<div className="empty-state"><Text message="No status events recorded."/></div>}</section>:null}
    {trackingMap?<TrackingLocationMap shipment={trackingMapData(trackingMap)}/>:null}
    {view==='TRACKING'&&appeals.length?<section className="card"><h2><Text message="Unloading appeals"/></h2>{appeals.map((appeal:any)=><article key={appeal.id}><p>{appeal.reason}</p><span className="status"><Text message={appeal.status}/></span>{appeal.status==='OPEN'?<WorkspaceTaskDialog title="Review unloading appeal" triggerLabel="Review appeal"><form action={`/api/admin/tracking-appeals/${appeal.id}`} method="post" className="stack"><input type="hidden" name="returnTo" value={returnTo}/><label><Text message="Investigation note"/><textarea name="note" minLength={5} maxLength={1000} required/></label><label><Text message="Decision"/><select name="decision" required defaultValue=""><option value="" disabled><Text message="Choose a decision"/></option><option value="APPROVED"><Text message="Approve handover after investigation"/></option><option value="RELEASED"><Text message="Release driver and close tracking"/></option><option value="DISMISSED"><Text message="Keep tracking active"/></option></select></label><button className="button"><Text message="Save decision"/></button></form></WorkspaceTaskDialog>:<p>{appeal.resolution_note}</p>}</article>)}</section>:null}
    {actions||view==='TRACKING'&&recovery?.actions?.length?<aside className="admin-operation-actions"><h2><Text message="Management"/></h2>{view==='TRACKING'?<TrackingRecoveryControls context={recovery} returnTo={returnTo}/>:actions}</aside>:null}
  </div>;
}
