import { requireUser } from '@/lib/auth';
import { getMemberSelection } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { ShipmentForm } from '@/components/shipment-form';
import { CirclePlus } from 'lucide-react';

export default async function NewShipmentPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(['SHIPPER','RECEIVER']); const query=await searchParams;
 const today=new Date().toISOString().slice(0,10);
 const selectedProvider=query.provider?await getMemberSelection(query.provider):null;
 return <div className="page load-posting-page"><PageHeader icon={CirclePlus} title="Post a shipment" subtitle="Cargo, route, deadline."/><Flash error={query.error}/>
 <ShipmentForm selectedProvider={selectedProvider?.ref||''} selectedProviderLabel={selectedProvider?.name||''} minDate={today}/></div>;
}
