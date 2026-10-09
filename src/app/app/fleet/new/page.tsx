
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {ArrowLeft,Save,ShieldCheck,Truck} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {canManageProviderVehicles} from '@/lib/fleet.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {VehicleRegistrationFields} from '@/components/vehicle-registration-fields';
import {getProviderCapacityWorkspace} from '@/lib/provider-capacity.js';
import {isIndependentDriver} from '@/lib/independent-driver.js';

export default async function AddFleetTruckPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser();
  if(!canManageProviderVehicles(user))redirect('/app/home');
  const query=await searchParams;
  const independent=isIndependentDriver(user),workspace=independent?await getProviderCapacityWorkspace(user):null;
  const current=workspace?.vehicles[0],replacing=Boolean(current&&query.replace===current.id);
  if(current&&!replacing)redirect(`/app/fleet/${current.id}`);
  if(!current&&query.replace)redirect('/app/fleet/new');
  const heading=replacing?'Change truck':independent?'Add your truck':'Add truck';
  return <div className="page vehicle-registration-page">
    <PageHeader icon={Truck} title={<Text message={heading}/>} subtitle={<Text message={independent?'One truck at a time. Its ownership or permission is recorded here.':'Register a truck you control.'}/>} action={<Link className="button secondary small" href={independent?'/app/home':'/app/fleet'}><ArrowLeft aria-hidden="true"/><Text message={independent?'Home':'My Fleet'}/></Link>}/>
    <Flash error={query.error}/>
    <form action="/api/fleet/vehicles" method="post" className="vehicle-registration-card">
      {replacing?<input type="hidden" name="replaceVehicleId" value={current.id}/>:null}
      <header><span><Truck aria-hidden="true"/></span><div><h2><Text message="Truck details"/></h2><p><Text message="Its Loadgistic truck number is created automatically."/></p></div></header>
      <div className="form-grid">
        {independent?<fieldset className="form-group full"><legend><Text message="How do you use this truck?"/></legend><label className="checkbox-control"><input type="radio" name="useBasis" value="OWNED" required/><Text message="I own this truck"/></label><label className="checkbox-control"><input type="radio" name="useBasis" value="PERMISSION" required/><Text message="I rent it or have the owner's permission"/></label></fieldset>:null}
        <div className="form-group"><label htmlFor="vehicle-make"><Text message="Make"/></label><Localized as="input" copy={["placeholder"]} id="vehicle-make" name="make" minLength={2} maxLength={60} placeholder="Isuzu" autoComplete="off" required/></div>
        <div className="form-group"><label htmlFor="vehicle-model"><Text message="Model"/></label><Localized as="input" copy={["placeholder"]} id="vehicle-model" name="model" minLength={1} maxLength={60} placeholder="NPR" autoComplete="off" required/></div>
        <VehicleRegistrationFields/>
        <div className="form-group full"><label htmlFor="vehicle-plate"><Text message="Plate number"/></label><Localized as="input" copy={["placeholder"]} id="vehicle-plate" name="plate" minLength={2} maxLength={32} placeholder="Record the current plate" autoComplete="off" required/><small><Text message="Plate details stay inside authorized provider and platform operations."/></small></div>
      </div>
      {replacing?<label className="checkbox-control"><input type="checkbox" name="replacementConfirmed" required/><Text message="Keep my previous truck in history and use this truck instead."/></label>:null}
      <aside className="vehicle-registration-preview"><span><ShieldCheck aria-hidden="true"/><span><strong><Text message="Registration is not verification"/></strong><small><Text message="Add ownership or authorization documents from Verification after saving."/></small></span></span></aside>
      {replacing?<p className="meta"><Text message="Finish active Tracking before changing trucks. Past documents and signals stay with the previous truck."/></p>:null}
      <div className="vehicle-registration-actions"><Link className="button secondary" href="/app/fleet"><Text message="Cancel"/></Link><button className="button success"><Save aria-hidden="true"/><Text message={heading}/></button></div>
    </form>
  </div>;
}
