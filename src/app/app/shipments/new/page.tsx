import { requireUser } from '@/lib/auth';
import { getMemberSelection } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { ShipmentForm } from '@/components/shipment-form';

export default async function NewShipmentPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(['SHIPPER','RECEIVER']); const query=await searchParams;
 const today=new Date().toISOString().slice(0,10);
 const selectedProvider=query.provider?getMemberSelection(query.provider):null;
 const selectedReceiver=query.receiver?getMemberSelection(`org:${query.receiver}`):null;
 return <div className="page load-posting-page"><PageHeader title="Post a load" subtitle="Show transporters what needs to move, where it goes, and when it must arrive."/><Flash error={query.error}/>
 <ShipmentForm workspaceName={user.organization_name||user.name} selectedProvider={selectedProvider?.ref||''} selectedProviderLabel={selectedProvider?.name||''} selectedReceiver={selectedReceiver?.id||''} selectedReceiverLabel={selectedReceiver?.name||''} minDate={today}/></div>;
}
