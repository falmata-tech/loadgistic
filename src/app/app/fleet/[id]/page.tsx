import {Text,Localized} from '@/components/localization';
import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {ArrowLeft,FileCheck2,Gauge,MapPin,RefreshCw,Truck,UserRound} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {getProviderCapacityWorkspace} from '@/lib/provider-capacity.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {CapacityForm} from '@/components/capacity-form';
import {canManageProviderVehicles} from '@/lib/fleet.js';
import {VehicleLifecycleControl} from '@/components/lifecycle-controls';
import {getVerificationCenter} from '@/lib/verification.js';
import {SubjectDocuments} from '@/components/subject-documents';
import {TruckDetailsEditor} from '@/components/truck-details-editor';
import {getProviderPublication} from '@/lib/provider-authority.js';
import {TruckAuthorityBadges,TruckPublicationControl,ProviderPublicationNotice} from '@/components/truck-authority';
import {TruckLocationSource} from '@/components/fleet-devices';
import {WorkspaceTaskDialog} from '@/components/workspace-task-dialog';
import {vehicleConfigurationImage} from '@/lib/vehicle-configurations';
import styles from '@/components/provider-fleet-workspace.module.css';

export default async function FleetTruckPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser();
 if(!canManageProviderVehicles(user))redirect('/app/home');
 const [{id},query]=await Promise.all([params,searchParams]);
 const workspace=await getProviderCapacityWorkspace(user);
 const vehicle:any=workspace.vehicles.find((item:any)=>item.id===id);
 if(!vehicle)notFound();
 const view=['details','documents','location'].includes(query.view||'')?query.view:'signals';
 const verification=view==='documents'?await getVerificationCenter(user):null;
 const publication=view==='details'||view==='signals'?await getProviderPublication(user):null;
 const current:any=workspace.capacities.find((item:any)=>item.vehicle_id===id);
 const option={id:String(vehicle.id),label:String(vehicle.label),make:String(vehicle.make||''),model:String(vehicle.model||''),cargoConfiguration:String(vehicle.cargo_configuration||vehicle.category||''),plate:String(vehicle.plate||''),platformNumber:String(vehicle.platform_number||''),driver:vehicle.assigned_driver||null,driverLocation:vehicle.driver_location||null,locationSelection:vehicle.location_selection,current:current?JSON.parse(JSON.stringify(current)):null};
 const selfAssigned=vehicle.assigned_driver?.id===user.id;
 const path='/app/fleet/'+id;
 return <div className={'page fleet-truck-detail-page '+styles.page}>
  <Link className={styles.back} href="/app/home/vehicles"><ArrowLeft aria-hidden="true"/><Text message="Manage vehicles"/></Link>
  <div className={styles.truckHeading}><Image src={vehicleConfigurationImage(vehicle.cargo_configuration||vehicle.category)} alt="" width={104} height={78}/><PageHeader title={vehicle.make+' '+vehicle.model} subtitle={<>{vehicle.plate||vehicle.platform_number} · <Text message={vehicle.cargo_configuration||vehicle.category}/></>}/><span className={'status '+(vehicle.publication_status==='LIVE'?'verified':'expired')}><Text message={vehicle.publication_status==='LIVE'?'Live':'Draft'}/></span></div>
  <Flash error={query.error} success={query.success}/>
  <Localized as="nav" copy={['aria-label']} className={styles.tabs} aria-label="Vehicle">
   <Link href={path} aria-current={view==='signals'?'page':undefined}><Gauge aria-hidden="true"/><Text message="Capacity signals"/></Link>
   <Link href={path+'?view=details'} aria-current={view==='details'?'page':undefined}><Truck aria-hidden="true"/><Text message="Vehicle details"/></Link>
   <Link href={path+'?view=documents'} aria-current={view==='documents'?'page':undefined}><FileCheck2 aria-hidden="true"/><Text message="Documents"/></Link>
   <Link href={path+'?view=location'} aria-current={view==='location'?'page':undefined}><MapPin aria-hidden="true"/><Text message="Location source"/></Link>
  </Localized>
  {view==='signals'?<>
   {publication?<ProviderPublicationNotice publication={publication}/>:null}
   <section className={'capacity-home-page fleet-truck-capacity-workspace '+styles.signalMap}><CapacityForm vehicles={[option]} initialVehicleId={id} allowDeviceLocation={selfAssigned} lockVehicleSelection showTruckIdentity={false} corridors={JSON.parse(JSON.stringify(workspace.corridors))} returnTo={path} allowCorridors renderedAt={Date.now()}/></section>
  </>:null}
  {view==='details'?<>
   <section className={styles.surface}><div className={styles.sectionHeading}><h2><Text message="Vehicle details"/></h2><TruckDetailsEditor vehicle={vehicle}/></div>
    <dl className={styles.detailFacts}><div><dt><Text message="Vehicle number"/></dt><dd>{vehicle.platform_number}</dd></div><div><dt><Text message="Plate number"/></dt><dd>{vehicle.plate||'—'}</dd></div><div><dt><Text message="Cargo configuration"/></dt><dd><Text message={vehicle.cargo_configuration||vehicle.category}/></dd></div><div><dt><Text message="How do you use this vehicle?"/></dt><dd><Text message={vehicle.use_basis==='OWNED'?'I own this vehicle':vehicle.use_basis==='FINANCED'?'I am buying this vehicle through financing':vehicle.use_basis==='PERMISSION'?'I rent it or have permission to use it':'Not set'}/></dd></div></dl>
    <Localized as="section" copy={['aria-label']} aria-label="Vehicle driver" className={styles.driverStrip}><UserRound aria-hidden="true"/><span>{vehicle.assigned_driver?.name||<Text message="No driver assigned"/>}</span><Link href={'/app/home/vehicles?view=drivers&vehicle='+id+(vehicle.assigned_driver?.id?'&driver='+vehicle.assigned_driver.id:'')}>{vehicle.assigned_driver?<Text message="Manage driver"/>:<Text message="Assign driver"/>}</Link></Localized>
    <TruckAuthorityBadges authority={vehicle.authority}/>
    {vehicle.trailer_interchangeable?<div className={styles.sectionHeading}><div><h3><Text message="Attached trailer"/></h3><p className="meta">{vehicle.cargo_configuration}</p></div><WorkspaceTaskDialog title="Attached trailer" triggerLabel="Update trailer"><form className="stack" action={'/api/fleet/vehicles/'+id+'/trailer'} method="post"><label htmlFor="attached-trailer"><Text message="Currently attached trailer"/><select id="attached-trailer" name="cargoConfiguration" defaultValue={vehicle.cargo_configuration}>{(vehicle.supported_trailer_configurations||[]).map((configuration:string)=><option key={configuration} value={configuration}>{configuration.replace('Tractor + ','')}</option>)}</select></label><button className="button success"><RefreshCw aria-hidden="true"/><Text message="Update trailer"/></button></form></WorkspaceTaskDialog></div>:null}
   </section>
   {publication?<TruckPublicationControl vehicleId={id} state={vehicle.publication_status} publication={publication} returnTo={path+'?view=details'}/>:null}
   <section className={styles.lifecycle}><div><h3><Text message="Retire vehicle"/></h3><p><Text message="Retirement removes this vehicle from discovery and ends its current Driver assignment. Resolve active Tracking first; history stays available."/></p></div><VehicleLifecycleControl id={id}/></section>
  </>:null}
  {view==='documents'&&verification?<section className={styles.surface} id="truck-documents"><SubjectDocuments center={verification} kind="VEHICLE" id={id} returnTo={path+'?view=documents'} readOnly/></section>:null}
  {view==='location'?<section className={styles.surface}><TruckLocationSource vehicleId={id}/></section>:null}
 </div>;
}
