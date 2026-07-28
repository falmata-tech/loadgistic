import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listOwnCapacity, listOwnVehicles } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { CapacityForm } from '@/components/capacity-form';

export default async function FleetTruckPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requireUser();
  if(user.role!=='TRANSPORTER')redirect('/app/home');
  const {id}=await params;
  const query=await searchParams;
  const vehicle:any=listOwnVehicles(user).find((item:any)=>item.id===id);
  if(!vehicle)notFound();
  const current:any=listOwnCapacity(user).find((item:any)=>item.vehicle_id===vehicle.id);
  const option={id:String(vehicle.id),label:String(vehicle.label),make:String(vehicle.make||''),model:String(vehicle.model||''),cargoConfiguration:String(vehicle.cargo_configuration||vehicle.category||''),plate:String(vehicle.plate||''),current:current||null};
  return <div className="page"><PageHeader title={`${vehicle.make} · ${vehicle.model}`} subtitle={`${vehicle.cargo_configuration||vehicle.category} · ${vehicle.plate||'Plate not recorded'}`} action={<Link className="button secondary icon-button-label" href="/app/fleet"><ArrowLeft aria-hidden="true"/>My Fleet</Link>}/><Flash error={query.error} success={query.success}/>
    <div className="permission-note"><MapPin aria-hidden="true"/><div><strong>Enter the truck's general area manually</strong><span>Only the driver with the truck can use phone GPS. Your device location may be the fleet office, not this truck.</span></div></div>
    <CapacityForm vehicles={[option]} initialVehicleId={vehicle.id} allowDeviceLocation={false} lockVehicleSelection/>
  </div>;
}
