
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {ArrowLeft,Save,ShieldCheck,Truck} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {canManageProviderVehicles} from '@/lib/fleet.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {VehicleRegistrationFields} from '@/components/vehicle-registration-fields';

export default async function AddFleetTruckPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser();
  if(!canManageProviderVehicles(user))redirect('/app/home');
  const query=await searchParams;
  return <div className="page vehicle-registration-page">
    <PageHeader icon={Truck} title={<Text message="Add truck"/>} subtitle={<Text message="Register a truck you control."/>} action={<Link className="button secondary small" href="/app/fleet"><ArrowLeft aria-hidden="true"/><Text message="My trucks"/></Link>}/>
    <Flash error={query.error}/>
    <form action="/api/fleet/vehicles" method="post" className="vehicle-registration-card">
      <header><span><Truck aria-hidden="true"/></span><div><h2><Text message="Truck details"/></h2><p><Text message="Its Loadgistic truck number is created automatically."/></p></div></header>
      <div className="form-grid">
        <div className="form-group"><label htmlFor="vehicle-make"><Text message="Make"/></label><Localized as="input" copy={["placeholder"]} id="vehicle-make" name="make" minLength={2} maxLength={60} placeholder="Isuzu" autoComplete="off" required/></div>
        <div className="form-group"><label htmlFor="vehicle-model"><Text message="Model"/></label><Localized as="input" copy={["placeholder"]} id="vehicle-model" name="model" minLength={1} maxLength={60} placeholder="NPR" autoComplete="off" required/></div>
        <VehicleRegistrationFields/>
        <div className="form-group full"><label htmlFor="vehicle-plate"><Text message="Plate number"/></label><Localized as="input" copy={["placeholder"]} id="vehicle-plate" name="plate" minLength={2} maxLength={32} placeholder="Record the current plate" autoComplete="off" required/><small><Text message="Plate details stay inside authorized provider and platform operations."/></small></div>
      </div>
      <aside className="vehicle-registration-preview"><span><ShieldCheck aria-hidden="true"/><span><strong><Text message="Registration is not verification"/></strong><small><Text message="Add ownership or authorization documents from Verification after saving."/></small></span></span></aside>
      <div className="vehicle-registration-actions"><Link className="button secondary" href="/app/fleet"><Text message="Cancel"/></Link><button className="button success"><Save aria-hidden="true"/><Text message="Add truck"/></button></div>
    </form>
  </div>;
}
