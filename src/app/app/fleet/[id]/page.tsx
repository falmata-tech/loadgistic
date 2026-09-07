import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, RefreshCw, Truck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getProviderCapacityWorkspace } from '@/lib/provider-capacity.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { CapacityForm } from '@/components/capacity-form';
import { canManageProviderVehicles } from '@/lib/fleet.js';

export default async function FleetTruckPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser();
  if(!canManageProviderVehicles(user))redirect('/app/home');
  const {id}=await params;
  const query=await searchParams;
  const workspace=await getProviderCapacityWorkspace(user);
  const vehicle:any=workspace.vehicles.find((item:any)=>item.id===id);
  if(!vehicle)notFound();
  const current:any=workspace.capacities.find((item:any)=>item.vehicle_id===vehicle.id);
  const option={id:String(vehicle.id),label:String(vehicle.label),make:String(vehicle.make||''),model:String(vehicle.model||''),cargoConfiguration:String(vehicle.cargo_configuration||vehicle.category||''),plate:String(vehicle.plate||''),platformNumber:String(vehicle.platform_number||''),current:current?JSON.parse(JSON.stringify(current)):null};
  const corridors=JSON.parse(JSON.stringify(workspace.corridors));
  const independent=user.role==='DRIVER';
  return <div className="page fleet-truck-detail-page"><PageHeader icon={Truck} title={`${vehicle.make} · ${vehicle.model}`} subtitle={`${vehicle.platform_number} · ${vehicle.cargo_configuration||vehicle.category} · plate ${vehicle.plate||'not recorded'}`} action={<Link className="button secondary small" href="/app/fleet"><ArrowLeft aria-hidden="true"/>My trucks</Link>}/><Flash error={query.error} success={query.success}/>
    {!independent?<div className="permission-note"><MapPin aria-hidden="true"/><div><strong>Assigned driver updates location</strong><span>Capacity and public visibility can still be managed here. The latest approximate location and update time stay with this truck.</span></div></div>:null}
    {vehicle.trailer_interchangeable?<form className="attached-trailer-card" action={`/api/fleet/vehicles/${vehicle.id}/trailer`} method="post"><div><span>Interchangeable tractor</span><strong>Attached trailer</strong><small>Capacity pages show this configuration only.</small></div><label htmlFor="attached-trailer">Currently attached trailer<select id="attached-trailer" name="cargoConfiguration" defaultValue={vehicle.cargo_configuration}>{(vehicle.supported_trailer_configurations||[]).map((configuration:string)=><option key={configuration} value={configuration}>{configuration.replace('Tractor + ','')}</option>)}</select></label><button className="button secondary"><RefreshCw aria-hidden="true"/>Update trailer</button></form>:null}
    <section className="capacity-home-page fleet-truck-capacity-workspace"><CapacityForm vehicles={[option]} initialVehicleId={vehicle.id} allowDeviceLocation={independent} lockVehicleSelection showTruckIdentity={false} corridors={corridors} returnTo={`/app/fleet/${vehicle.id}`} allowCorridors renderedAt={Date.now()}/></section>
  </div>;
}
