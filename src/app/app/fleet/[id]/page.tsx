import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin, Truck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listOwnCapacity, listOwnNextTrips, listOwnRecurringCorridors, listOwnVehicles } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { CapacityForm } from '@/components/capacity-form';
import { CapacityMarketPlanning } from '@/components/capacity-market-planning';

export default async function FleetTruckPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser();
  if(user.role!=='TRANSPORTER')redirect('/app/home');
  const {id}=await params;
  const query=await searchParams;
  const vehicle:any=listOwnVehicles(user).find((item:any)=>item.id===id);
  if(!vehicle)notFound();
  const current:any=listOwnCapacity(user).find((item:any)=>item.vehicle_id===vehicle.id);
  const option={id:String(vehicle.id),label:String(vehicle.label),make:String(vehicle.make||''),model:String(vehicle.model||''),cargoConfiguration:String(vehicle.cargo_configuration||vehicle.category||''),plate:String(vehicle.plate||''),platformNumber:String(vehicle.platform_number||''),current:current?JSON.parse(JSON.stringify(current)):null};
  const nextTrips=JSON.parse(JSON.stringify(listOwnNextTrips(user).filter((trip:any)=>trip.vehicle_id===vehicle.id)));
  const corridors=JSON.parse(JSON.stringify(listOwnRecurringCorridors(user)));
  return <div className="page"><PageHeader icon={Truck} title={`${vehicle.make} · ${vehicle.model}`} subtitle={`${vehicle.platform_number} · ${vehicle.cargo_configuration||vehicle.category} · plate ${vehicle.plate||'not recorded'}`} action={<Link className="button secondary icon-button-label" href="/app/fleet"><ArrowLeft aria-hidden="true"/>Fleet</Link>}/><Flash error={query.error} success={query.success}/>
    <div className="permission-note"><MapPin aria-hidden="true"/><div><strong>Location comes from the assigned Driver</strong><span>You can update capacity and visibility here. The truck keeps the Driver's last privacy-obscured location and original update time.</span></div></div>
    <CapacityForm vehicles={[option]} initialVehicleId={vehicle.id} allowDeviceLocation={false} lockVehicleSelection/>
    <CapacityMarketPlanning vehicles={[JSON.parse(JSON.stringify(vehicle))]} nextTrips={nextTrips} corridors={corridors} returnTo={`/app/fleet/${vehicle.id}`} allowCorridors/>
  </div>;
}
