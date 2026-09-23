
import {Text,Localized} from '@/components/localization';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Truck, UserRound } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getProviderCapacityWorkspace } from '@/lib/provider-capacity.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { CapacityForm } from '@/components/capacity-form';
import { canManageProviderVehicles } from '@/lib/fleet.js';
import {VehicleLifecycleControl} from '@/components/lifecycle-controls';
import {getVerificationCenter} from '@/lib/verification.js';
import {VerificationBadges} from '@/components/verification-badges';
import {TruckDetailsEditor} from '@/components/truck-details-editor';

export default async function FleetTruckPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser();
  if(!canManageProviderVehicles(user))redirect('/app/home');
  const {id}=await params;
  const query=await searchParams;
  const workspace=await getProviderCapacityWorkspace(user);
  const vehicle:any=workspace.vehicles.find((item:any)=>item.id===id);
  if(!vehicle)notFound();
  const verification=await getVerificationCenter(user);
  const truckEvidence=verification.subjects.find((subject:{subject_type:string;subject_id:string})=>subject.subject_type==='VEHICLE'&&subject.subject_id===id);
  const current:any=workspace.capacities.find((item:any)=>item.vehicle_id===vehicle.id);
  const option={id:String(vehicle.id),label:String(vehicle.label),make:String(vehicle.make||''),model:String(vehicle.model||''),cargoConfiguration:String(vehicle.cargo_configuration||vehicle.category||''),plate:String(vehicle.plate||''),platformNumber:String(vehicle.platform_number||''),driver:vehicle.assigned_driver||null,current:current?JSON.parse(JSON.stringify(current)):null};
  const corridors=JSON.parse(JSON.stringify(workspace.corridors));
  const independent=user.role==='DRIVER';
  return <div className="page fleet-truck-detail-page"><PageHeader icon={Truck} title={`${vehicle.make} · ${vehicle.model}`} subtitle={`${vehicle.platform_number} · ${vehicle.cargo_configuration||vehicle.category} · plate ${vehicle.plate||'not recorded'}`} action={<Link className="button secondary small" href="/app/fleet"><ArrowLeft aria-hidden="true"/><Text message="My trucks"/></Link>}/><Flash error={query.error} success={query.success}/>
    <Localized as="section" copy={["aria-label"]} className="truck-driver-link" aria-label="Truck driver"><UserRound aria-hidden="true"/><div><small>{independent?<Text message="Driver"/>:<Text message="Assigned driver"/>}</small><strong>{vehicle.assigned_driver?.name||'No driver assigned'}</strong><span>{independent?<Text message="You operate this truck."/>:vehicle.assigned_driver?'Company driver · '+(user.organization_name||'Your fleet'):<Text message="Assign an active driver before publishing capacity."/>}</span></div>{!independent?<Link className="button secondary small" href={`/app/fleet?vehicle=${vehicle.id}#driver-access`}>{vehicle.assigned_driver?<Text message="Manage driver"/>:<Text message="Assign driver"/>}</Link>:null}</Localized>
    {vehicle.trailer_interchangeable?<form className="attached-trailer-card" action={`/api/fleet/vehicles/${vehicle.id}/trailer`} method="post"><div><span><Text message="Interchangeable tractor"/></span><strong><Text message="Attached trailer"/></strong><small><Text message="Capacity pages show this configuration only."/></small></div><label htmlFor="attached-trailer"><Text message="Currently attached trailer"/><select id="attached-trailer" name="cargoConfiguration" defaultValue={vehicle.cargo_configuration}>{(vehicle.supported_trailer_configurations||[]).map((configuration:string)=><option key={configuration} value={configuration}>{configuration.replace('Tractor + ','')}</option>)}</select></label><button className="button secondary"><RefreshCw aria-hidden="true"/><Text message="Update trailer"/></button></form>:null}
    <section className="card stack"><h2><Text message="Truck documents"/></h2><VerificationBadges badges={truckEvidence?.badges}/><Link className="button secondary small" href={`/app/verification?truck=${vehicle.id}`}><Text message="Submit a truck document"/></Link></section>
    <TruckDetailsEditor vehicle={vehicle}/>

    <VehicleLifecycleControl id={vehicle.id}/>
    <section className="capacity-home-page fleet-truck-capacity-workspace"><CapacityForm vehicles={[option]} initialVehicleId={vehicle.id} allowDeviceLocation={independent} lockVehicleSelection showTruckIdentity={false} corridors={corridors} returnTo={`/app/fleet/${vehicle.id}`} allowCorridors renderedAt={Date.now()}/></section>
  </div>;
}
