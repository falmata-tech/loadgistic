import { requireUser } from '@/lib/auth';
import { listOrganizationsByType, listProviders } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { ShipmentForm } from '@/components/shipment-form';

export default async function NewShipmentPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(['SHIPPER','RECEIVER']); const query=await searchParams;
 const receivers=listOrganizationsByType(['ENTERPRISE_RECEIVER','ENTERPRISE_SHIPPER']);
 const providers=listProviders('ALL');
 const today=new Date().toISOString().slice(0,10);
 const businessOptions=receivers.filter((o:any)=>o.id!==user.organization_id).map((o:any)=>({id:String(o.id),name:String(o.name)}));
 const providerOptions=providers.map((p:any)=>({id:String(p.id),name:String(p.name),type:String(p.type),ref_kind:String(p.ref_kind)}));
 return <div className="page load-posting-page"><PageHeader title="Post a load" subtitle="Show transporters what needs to move, where it goes, and when it must arrive."/><Flash error={query.error}/>
 <ShipmentForm workspaceName={user.organization_name||user.name} businesses={businessOptions} providers={providerOptions} selectedProvider={query.provider||''} selectedReceiver={query.receiver||''} minDate={today}/></div>;
}
