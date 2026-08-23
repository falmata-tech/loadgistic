import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ClipboardPlus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getDriverAccess, listOwnVehicles } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { ProviderShipmentForm } from '@/components/provider-shipment-form';

export default async function NewProviderShipmentPage(){
  const user=await requireUser();
  if(!['TRANSPORTER','DRIVER'].includes(user.role))redirect('/app/home?error=Only+transport+providers+can+start+Tracking.');
  if((await getDriverAccess(user))?.can_manage_tracking===false)redirect('/app/provider-shipments?error=Tracking+access+is+off.');
  const vehicles=await listOwnVehicles(user);
  return <div className="page"><PageHeader icon={ClipboardPlus} title="Start Tracking" subtitle="After agreeing the work offline, create one Tracking session and send its access to the customer owner." action={<Link className="button secondary" href="/app/provider-shipments"><ArrowLeft aria-hidden="true"/>Tracking</Link>}/><ProviderShipmentForm vehicles={vehicles}/></div>;
}
