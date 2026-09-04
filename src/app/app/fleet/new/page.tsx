import Image from 'next/image';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {ArrowLeft,Save,ShieldCheck,Truck} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {canManageProviderVehicles} from '@/lib/fleet.js';
import {VEHICLE_CONFIGURATIONS} from '@/lib/vehicle-configurations';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';

export default async function AddFleetTruckPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser();
  if(!canManageProviderVehicles(user))redirect('/app/home');
  const query=await searchParams;
  return <div className="page vehicle-registration-page">
    <PageHeader icon={Truck} title="Add truck" subtitle="Register a truck you control." action={<Link className="button secondary small" href="/app/fleet"><ArrowLeft aria-hidden="true"/>My trucks</Link>}/>
    <Flash error={query.error}/>
    <form action="/api/fleet/vehicles" method="post" className="vehicle-registration-card">
      <header><span><Truck aria-hidden="true"/></span><div><h2>Truck details</h2><p>Its Loadgistic truck number is created automatically.</p></div></header>
      <div className="form-grid">
        <div className="form-group"><label htmlFor="vehicle-make">Make</label><input id="vehicle-make" name="make" minLength={2} maxLength={60} placeholder="Isuzu" autoComplete="off" required/></div>
        <div className="form-group"><label htmlFor="vehicle-model">Model</label><input id="vehicle-model" name="model" minLength={1} maxLength={60} placeholder="NPR" autoComplete="off" required/></div>
        <div className="form-group full"><label htmlFor="vehicle-configuration">Cargo configuration</label><select id="vehicle-configuration" name="cargoConfiguration" required defaultValue=""><option value="" disabled>Choose the truck body</option>{VEHICLE_CONFIGURATIONS.map(item=><option value={item.name} key={item.name}>{item.name}</option>)}</select></div>
        <div className="form-group full"><label htmlFor="vehicle-plate">Plate number</label><input id="vehicle-plate" name="plate" minLength={2} maxLength={32} placeholder="Record the current plate" autoComplete="off" required/><small>Plate details stay inside authorized provider and platform operations.</small></div>
      </div>
      <aside className="vehicle-registration-preview"><Image src="/vehicle-configurations/light-stake-body-truck.jpg" alt="Example standardized truck presentation" width={180} height={135}/><span><ShieldCheck aria-hidden="true"/><span><strong>Registration is not verification</strong><small>Add ownership or authorization documents from Verification after saving.</small></span></span></aside>
      <div className="vehicle-registration-actions"><Link className="button secondary" href="/app/fleet">Cancel</Link><button className="button success"><Save aria-hidden="true"/>Add truck</button></div>
    </form>
  </div>;
}
