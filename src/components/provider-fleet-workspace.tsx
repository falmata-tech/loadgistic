import Link from 'next/link';
import Image from 'next/image';
import {redirect} from 'next/navigation';
import {ArrowLeft,ArrowRight,Check,Eye,KeyRound,Plus,Satellite,Save,Truck,UserRound} from 'lucide-react';
import {Text,Localized} from '@/components/localization';
import {requireUser} from '@/lib/auth';
import {canManageProviderVehicles,getFleetDriverPage,getFleetDriver} from '@/lib/fleet.js';
import {pendingFleetInvitations} from '@/lib/fleet-driver-management';
import {fleetReturnPath} from '@/lib/fleet-navigation.js';
import {getProviderPublication} from '@/lib/provider-authority.js';
import {getProviderCapacityWorkspace} from '@/lib/provider-capacity.js';
import {getVerificationCenter} from '@/lib/verification.js';
import {retiredVehiclePage} from '@/lib/lifecycle.js';
import {selectedCapacityLocation} from '@/lib/capacity-location-selection.js';
import {paginateResults} from '@/lib/pagination.js';
import {relativeTime} from '@/lib/ui';
import {vehicleConfigurationImage} from '@/lib/vehicle-configurations';
import {FleetInvitations,FleetDriverContact} from '@/components/fleet-driver-tools';
import {ProviderPublicationNotice} from '@/components/truck-authority';
import {PageHeader} from '@/components/page-header';
import {StatusPill} from '@/components/status-pill';
import {Flash} from '@/components/flash';
import {Pagination} from '@/components/pagination';
import {VerificationBadges} from '@/components/verification-badges';
import {SubjectDocuments} from '@/components/subject-documents';
import {VehicleLifecycleControl} from '@/components/lifecycle-controls';
import {WorkspaceTaskDialog} from '@/components/workspace-task-dialog';
import {FleetDevices} from './fleet-devices';
import styles from './provider-fleet-workspace.module.css';

export async function FleetWorkspace({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser();
 if(!canManageProviderVehicles(user))redirect('/app/home');
 const query=await searchParams;
 // Older assignment links retain their exact context without opening every editor.
 const view=query.view==='devices'?'devices':query.view==='drivers'||query.driver||query.vehicle?'drivers':'trucks';
 const driverTask=query.task==='documents'?'documents':query.task==='contact'?'contact':'assignment';
 const [publication,retired,capacityWorkspace,driverResult]=await Promise.all([
  getProviderPublication(user),retiredVehiclePage(user,Number(query.retiredPage||1)),
  getProviderCapacityWorkspace(user),getFleetDriverPage(user,{page:query.driverPage,pageSize:10})
 ]);
 const allVehicles:any[]=capacityWorkspace.vehicles;
 const vehicleResult:any=paginateResults(allVehicles,{page:query.truckPage,pageSize:10});
 const vehicles:any[]=vehicleResult.items,drivers:any[]=driverResult.items;
 const latest=new Map();for(const item of capacityWorkspace.capacities)if(!latest.has(item.vehicle_id))latest.set(item.vehicle_id,item);
 const targetVehicle=allVehicles.find(vehicle=>vehicle.id===query.vehicle);
 let selectedDriver=drivers.find(driver=>driver.id===query.driver);
 if(query.driver&&!selectedDriver){
  try{selectedDriver=await getFleetDriver(user,query.driver);}
  catch(error){
   if(error instanceof Error&&error.message==='FORBIDDEN')redirect('/app/home');
   const unavailable=error instanceof Error&&error.message==='NOT_FOUND';
   return <div className={'page '+styles.page}><PageHeader icon={Truck} title={<Text message="My Fleet"/>}/><p className="alert error" role="alert"><Text message={unavailable?'This driver is no longer available in your fleet.':'Unable to load driver details. Try again.'}/></p><Link className="button secondary" href="/app/fleet?view=drivers"><ArrowLeft aria-hidden="true"/><Text message="Drivers"/></Link></div>;
  }
 }
 const archived=query.scope==='retired'&&retired.total>0;
 const baseQuery={truckPage:query.truckPage,driverPage:query.driverPage,vehicle:query.vehicle};
 const href=(next:Record<string,string|undefined>)=>{
  const params=new URLSearchParams();for(const [key,value]of Object.entries({...baseQuery,...next}))if(value)params.set(key,value);
  return '/app/fleet?'+params;
 };
 const returnTo=fleetReturnPath(href({view:'drivers',driver:selectedDriver?.id,task:driverTask}));
 const [invitations,verification]=await Promise.all([
  view==='drivers'?pendingFleetInvitations(user.id):Promise.resolve([]),
  view==='drivers'&&selectedDriver&&driverTask==='documents'?getVerificationCenter(user):Promise.resolve(null)
 ]);
 const addAction=view==='trucks'?<Link className="button success small" href="/app/fleet/new"><Plus aria-hidden="true"/><Text message="Add vehicle"/></Link>:
  view==='drivers'&&!selectedDriver?<Link className="button success small" href={'/app/fleet/drivers/new?returnTo='+encodeURIComponent(returnTo)}><Plus aria-hidden="true"/><Text message="Add driver"/></Link>:null;
 return <div className={'page '+styles.page}>
  <PageHeader icon={Truck} title={<Text message="My Fleet"/>} action={addAction}/>
  <Flash error={query.error} success={query.success}/>
  <Localized as="nav" copy={['aria-label']} className={styles.tabs} aria-label="My Fleet">
   <Link href={href({view:'trucks',vehicle:undefined})} aria-current={view==='trucks'?'page':undefined}><Truck aria-hidden="true"/><Text message="Vehicles"/><span>{allVehicles.length}</span></Link>
   <Link href={href({view:'drivers'})} aria-current={view==='drivers'?'page':undefined}><UserRound aria-hidden="true"/><Text message="Drivers"/><span>{driverResult.total}</span></Link>
   <Link href={href({view:'devices',vehicle:undefined})} aria-current={view==='devices'?'page':undefined}><Satellite aria-hidden="true"/><Text message="GPS devices"/></Link>
  </Localized>
  {view==='trucks'?<>
   <ProviderPublicationNotice publication={publication}/>
   {retired.total>0?<div className={styles.scope}><Link href={href({view:'trucks',scope:undefined})} aria-current={!archived?'page':undefined}><Text message="Active"/> · {allVehicles.length}</Link><Link href={href({view:'trucks',scope:'retired'})} aria-current={archived?'page':undefined}><Text message="Retired vehicles"/> · {retired.total}</Link></div>:null}
   <Localized as="section" copy={['aria-label']} className={styles.surface} aria-label={archived?'Retired vehicles':'Vehicles'}>
    {archived?<div className={styles.rows}>{retired.items.map((truck:any)=><article className={styles.archiveRow} key={truck.id}><div><strong>{truck.make} {truck.model}</strong><span className="meta">{truck.platform_number}</span></div><VehicleLifecycleControl id={truck.id} retired/></article>)}</div>:
     vehicles.length?<div className={styles.rows}>{vehicles.map(vehicle=>{
      const cap:any=latest.get(vehicle.id),location=selectedCapacityLocation({selection:vehicle.location_selection,published:cap?.location_updated_at?{area:cap.location_area,updatedAt:cap.location_updated_at}:null,phone:vehicle.driver_location});
      return <article className={styles.truckRow} key={vehicle.id}>
       <Image className={styles.thumbnail} src={vehicleConfigurationImage(vehicle.cargo_configuration||vehicle.category)} alt="" width={88} height={72}/>
       <div className={styles.identity}><strong>{vehicle.make} {vehicle.model}</strong><span>{vehicle.plate||vehicle.platform_number} · <Text message={vehicle.cargo_configuration||vehicle.category}/></span><span className={styles.driver}><UserRound aria-hidden="true"/>{vehicle.assigned_driver?.name||<Text message="No driver assigned"/>}</span></div>
       <div className={styles.location}><strong>{location?.area||<Text message="Location not updated"/>}</strong><span>{location?.updatedAt?relativeTime(location.updatedAt):<Text message="No location timestamp"/>}</span></div>
       <div className={styles.states}><span className={'status '+(vehicle.publication_status==='LIVE'?'verified':'expired')}><Text message={vehicle.publication_status==='LIVE'?'Live':'Draft'}/></span>{cap?<StatusPill status={cap.status}/>:null}</div>
       <Link href={'/app/fleet/'+vehicle.id} className="button secondary small"><Eye aria-hidden="true"/><Text message="View vehicle"/></Link>
      </article>;
     })}</div>:<div className={styles.empty}><Truck aria-hidden="true"/><h2><Text message="No vehicles added yet."/></h2><p><Text message="Add the first vehicle before publishing capacity or starting Tracking."/></p></div>}
    {(archived?retired:vehicleResult).pageCount>1?<Pagination path="/app/fleet" query={{...baseQuery,view:'trucks',scope:archived?'retired':undefined}} page={(archived?retired:vehicleResult).page} pageCount={(archived?retired:vehicleResult).pageCount} total={(archived?retired:vehicleResult).total} pageParam={archived?'retiredPage':'truckPage'}/>:null}
   </Localized>
  </>:null}
  {view==='devices'?<section className={styles.surface}><FleetDevices/></section>:null}
  {view==='drivers'?<section className={styles.surface} id="driver-access">
   {selectedDriver?<>
    <Link className={styles.back} href={href({view:'drivers',driver:undefined})}><ArrowLeft aria-hidden="true"/><Text message="Drivers"/></Link>
    <header className={styles.entityHeading}><span className={styles.entityIcon}><UserRound aria-hidden="true"/></span><div><h2>{selectedDriver.name}{selectedDriver.is_owner?<small> · <Text message="You"/></small>:null}</h2><p>{selectedDriver.phone||<Text message="Phone not added"/>}</p></div></header>
    <Localized as="nav" copy={['aria-label']} className={styles.tabs} aria-label="Driver"><Link href={href({view:'drivers',driver:selectedDriver.id})} aria-current={driverTask==='assignment'?'page':undefined}><Text message="Assigned vehicle"/></Link><Link href={href({view:'drivers',driver:selectedDriver.id,task:'documents'})} aria-current={driverTask==='documents'?'page':undefined}><Text message="Driver documents"/></Link>{!selectedDriver.is_owner?<Link href={href({view:'drivers',driver:selectedDriver.id,task:'contact'})} aria-current={driverTask==='contact'?'page':undefined}><Text message="Contact"/></Link>:null}</Localized>
    {driverTask==='documents'?verification?<SubjectDocuments center={verification} kind="DRIVER" id={selectedDriver.id} returnTo={returnTo} readOnly/>:null:driverTask==='contact'?!selectedDriver.is_owner?<FleetDriverContact id={selectedDriver.id} name={selectedDriver.name} phone={selectedDriver.phone} returnTo={returnTo}/>:null:<>
     <div className={styles.sectionHeading}><h3><Text message="Assigned vehicle"/></h3><WorkspaceTaskDialog title="Assigned vehicle" triggerLabel="Edit assignment"><form action={'/api/fleet/drivers/'+selectedDriver.id+'/permissions'} method="post" className="stack">
      <input type="hidden" name="returnTo" value={targetVehicle?'/app/fleet/'+targetVehicle.id:returnTo}/>
      {targetVehicle?<p><Text message="Assign a driver to {truck}. Choose a driver below and save." values={{truck:targetVehicle.make+' '+targetVehicle.model}}/></p>:null}
      <div className="form-group"><label htmlFor={'driver-truck-'+selectedDriver.id}><Text message="Vehicle"/></label><select id={'driver-truck-'+selectedDriver.id} name="vehicleId" defaultValue={targetVehicle?.id||selectedDriver.assigned_vehicle_id||''}><option value=""><Text message="No vehicle assigned"/></option>{allVehicles.map(vehicle=><option value={vehicle.id} key={vehicle.id}>{vehicle.platform_number} · {vehicle.make} {vehicle.model}</option>)}</select></div>
      {selectedDriver.is_owner?<><input type="hidden" name="canManageCapacity" value="on"/><input type="hidden" name="canManageTracking" value="on"/></>:<fieldset className={styles.permissions}><legend><Text message="Allowed work"/></legend><label><input type="checkbox" name="canManageCapacity" defaultChecked={Boolean(selectedDriver.can_manage_capacity)}/><Text message="Capacity updates"/></label><label><input type="checkbox" name="canManageTracking" defaultChecked={Boolean(selectedDriver.can_manage_tracking)}/><Text message="Tracking updates"/></label><p className="meta"><Text message="Duty control remains available for an assigned vehicle."/></p></fieldset>}
      <button className="button success"><Save aria-hidden="true"/><Text message="Save driver"/></button>
     </form></WorkspaceTaskDialog></div>
     <div className={styles.assignment}><Truck aria-hidden="true"/><strong>{selectedDriver.assigned_vehicles||<Text message="No vehicle assigned"/>}</strong>{selectedDriver.assigned_vehicle_id?<Link className="button secondary small" href={'/app/fleet/'+selectedDriver.assigned_vehicle_id}><Eye aria-hidden="true"/><Text message="View vehicle"/></Link>:null}</div>
     <h3><Text message="Allowed work"/></h3><div className={styles.access}><span className={selectedDriver.is_owner||selectedDriver.can_manage_capacity?styles.allowed:undefined}>{selectedDriver.is_owner||selectedDriver.can_manage_capacity?<Check aria-hidden="true"/>:<KeyRound aria-hidden="true"/>}<Text message="Capacity updates"/> · <Text message={selectedDriver.is_owner||selectedDriver.can_manage_capacity?'On':'Off'}/></span><span className={selectedDriver.is_owner||selectedDriver.can_manage_tracking?styles.allowed:undefined}>{selectedDriver.is_owner||selectedDriver.can_manage_tracking?<Check aria-hidden="true"/>:<KeyRound aria-hidden="true"/>}<Text message="Tracking updates"/> · <Text message={selectedDriver.is_owner||selectedDriver.can_manage_tracking?'On':'Off'}/></span></div>
     <VerificationBadges badges={selectedDriver.verification_badges} compact label="Driver documents"/><VerificationBadges badges={selectedDriver.truck_verification_badges} compact label="Assigned-vehicle authorization"/>
    </>}
   </>:<>
    {targetVehicle?<p className="alert"><Text message="Assign a driver to {truck}. Choose a driver below and save." values={{truck:targetVehicle.make+' '+targetVehicle.model}}/></p>:null}
    <div className={styles.rows}>{drivers.map(driver=><article className={styles.driverRow} key={driver.id}><span className={styles.entityIcon}><UserRound aria-hidden="true"/></span><div className={styles.identity}><strong>{driver.name}{driver.is_owner?<small> · <Text message="You"/></small>:null}</strong><span>{driver.assigned_vehicles||<Text message="No vehicle assigned"/>}</span></div><span className={styles.phone}>{driver.phone||<Text message="Phone not added"/>}</span><Link className="button secondary small" href={href({view:'drivers',driver:driver.id})}><Text message="Manage"/><ArrowRight aria-hidden="true"/></Link></article>)}</div>
    {!drivers.length?<div className={styles.empty}><UserRound aria-hidden="true"/><h2><Text message="No driver assigned"/></h2><p><Text message="Add a driver, then assign their vehicle. They verify their email when signing in."/></p></div>:null}
    {driverResult.pageCount>1?<Pagination path="/app/fleet" query={{...baseQuery,view:'drivers'}} page={driverResult.page} pageCount={driverResult.pageCount} total={driverResult.total} pageParam="driverPage"/>:null}
    <FleetInvitations invitations={invitations} returnTo={returnTo} showAdd={false}/>
   </>}
  </section>:null}
 </div>;
}
