
import {Text} from '@/components/localization';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ClipboardPlus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getProviderTrackingWorkspace } from '@/lib/provider-tracking.js';
import { PageHeader } from '@/components/page-header';
import { ProviderShipmentForm } from '@/components/provider-shipment-form';
import {FleetSetupEmpty} from '@/components/fleet-setup-empty';

export default async function NewProviderShipmentPage(){
  const user=await requireUser();
  if(!['TRANSPORTER','DRIVER'].includes(user.role))redirect('/app/home?error=Only+transport+providers+can+start+Tracking.');
  const workspace=await getProviderTrackingWorkspace(user,{limit:1});
  if(workspace.access?.can_manage_tracking===false)redirect('/app/provider-shipments?error=Tracking+access+is+off.');
  const vehicles=workspace.vehicles||[];
  return <div className="page"><PageHeader icon={ClipboardPlus} title={<Text message="Start Tracking"/>} subtitle={<Text message="Choose the truck and give your shipment partners a private view of progress on the work you’ve agreed."/>} action={<Link className="button secondary" href="/app/provider-shipments"><ArrowLeft aria-hidden="true"/><Text message="Tracking"/></Link>}/>{vehicles.length?<ProviderShipmentForm vehicles={vehicles}/>:<FleetSetupEmpty companyDriver={user.driver_kind==='COMPANY'} fleetOwner={user.role==='TRANSPORTER'}/>}</div>;
}
