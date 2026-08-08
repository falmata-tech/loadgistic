import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ClipboardPlus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listOwnVehicles } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { ProviderShipmentForm } from '@/components/provider-shipment-form';

export default async function NewProviderShipmentPage(){
  const user=await requireUser();
  if(!['TRANSPORTER','DRIVER'].includes(user.role)||user.driver_kind==='COMPANY')redirect('/app/home?error=Only+provider+owners+can+create+shipment+records.');
  const vehicles=listOwnVehicles(user);
  return <div className="page"><PageHeader icon={ClipboardPlus} title="Start customer tracking" subtitle="Record an agreed shipment and issue separate private access codes." action={<Link className="button secondary" href="/app/provider-shipments"><ArrowLeft aria-hidden="true"/>Shipments</Link>}/><ProviderShipmentForm vehicles={vehicles}/></div>;
}
