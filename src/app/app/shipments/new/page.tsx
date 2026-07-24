import { requireUser } from '@/lib/auth';
import { listOrganizationsByType, listProviders } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';

export default async function NewShipmentPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(['SHIPPER','RECEIVER','ADMIN']); const query=await searchParams;
 const receivers=listOrganizationsByType(['ENTERPRISE_RECEIVER','ENTERPRISE_SHIPPER']);
 const providers=listProviders('ALL');
 const today=new Date().toISOString().slice(0,10);
 return <div className="page"><PageHeader title="New B2B shipment" subtitle="Choose parcel delivery or road freight. Keep each step simple."/><Flash error={query.error}/>
 <form action="/api/shipments" method="post" className="form-card stack" data-testid="new-shipment-form">
  <div className="form-grid">
   <div className="form-group"><label>Shipment title</label><input name="title" required placeholder="Example: Retail cartons to Hawassa branch"/></div>
   <div className="form-group"><label>Service</label><select name="serviceMode" required defaultValue="PARCEL"><option value="PARCEL">Parcel Delivery</option><option value="FREIGHT">Road Freight</option></select></div>
   <div className="form-group"><label>Sender / shipper</label><input value={user.organization_name||user.name} readOnly/></div>
   <div className="form-group"><label>Business receiver</label><select name="receiverOrganizationId"><option value="">Not selected / external receiver</option>{receivers.filter((o:any)=>o.id!==user.organization_id).map((o:any)=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
   <div className="form-group"><label>Origin</label><input name="origin" required placeholder="Addis Ababa"/></div>
   <div className="form-group"><label>Destination</label><input name="destination" required placeholder="Hawassa"/></div>
   <div className="form-group"><label>Pickup date</label><input name="pickupDate" type="date" min={today} required/></div>
   <div className="form-group"><label>Desired delivery date</label><input name="deliveryDate" type="date" min={today}/></div>
   <div className="form-group full"><label>Cargo or package description</label><textarea name="cargoDescription" required placeholder="What is being shipped? Keep sensitive details out."/></div>
   <div className="form-group"><label>Package count</label><input name="packageCount" type="number" min="1" defaultValue="1"/></div>
   <div className="form-group"><label>Estimated weight (kg, optional)</label><input name="estimatedWeight" type="number" min="0" step="0.1"/></div>
   <div className="form-group"><label>Vehicle category (freight only)</label><input name="vehicleCategory" placeholder="10 Ton Truck"/></div>
   <div className="form-group"><label>Load type (freight only)</label><select name="loadType"><option value="">Not applicable</option><option value="FULL_LOAD">Full Load</option><option value="SHARED_CAPACITY">Shared Capacity</option></select></div>
   <div className="form-group"><label>How should providers see it?</label><select name="distributionMode" defaultValue="DIRECT_TO_PROVIDER"><option value="DIRECT_TO_PROVIDER">Direct to selected provider</option><option value="SAVED_PARTNERS">Saved partners</option><option value="OPEN_MARKET">Open load market</option></select></div>
   <div className="form-group"><label>Selected provider</label><select name="providerRef"><option value="">Choose for a direct request</option>{providers.map((p:any)=><option key={`${p.ref_kind}-${p.id}`} value={`${p.ref_kind}:${p.id}`}>{p.name} — {p.type.replaceAll('_',' ')}</option>)}</select></div>
   <div className="form-group"><label>Pricing</label><select name="priceMode" defaultValue="QUOTE_REQUESTED"><option value="QUOTE_REQUESTED">Quote Requested</option><option value="FIXED_PRICE">Fixed price in ETB</option><option value="TARGET_PRICE">Target price in ETB</option></select></div>
   <div className="form-group"><label>Fixed amount (ETB)</label><input name="priceEtb" type="number" min="0" step="1" placeholder="35000"/></div>
   <div className="form-group"><label>Target amount (ETB)</label><input name="targetPriceEtb" type="number" min="0" step="1" placeholder="35000"/></div>
   <div className="form-group"><label>Tracking</label><select name="trackingMode" defaultValue="NONE"><option value="NONE">No public tracking</option><option value="STATUS_ONLY">Simple status timeline</option><option value="LOCATION_AND_PROOF">Location and proof</option></select></div>
  </div>
  <div className="alert">Parcel requests must be directed to a parcel delivery company. Freight loads may be direct, partner-visible, or open.</div>
  <button className="button" type="submit">Create shipment</button>
 </form></div>;
}
