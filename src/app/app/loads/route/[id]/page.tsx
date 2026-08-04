import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowDown, ArrowRight, Boxes, MapPinned, Route } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAlongRouteLoad, getDriverAccess } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { LoadBoardCard } from '@/components/load-board-card';

export default async function AlongRouteLoadPage({params}:{params:Promise<{id:string}>}){
  const user=await requireUser(['TRANSPORTER','DRIVER','ADMIN']);
  const {id}=await params;
  const chain:any=getAlongRouteLoad(user,id);
  if(!chain)notFound();
  const access=getDriverAccess(user);
  const canNegotiate=access?.can_negotiate_loads!==false&&access?.can_contact_businesses!==false;
  return <div className="page">
    <PageHeader icon={MapPinned} title="Along the route" subtitle={`${chain.member_count} separate shipments in travel order`} action={<Link className="button secondary icon-button-label" href="/app/loads?board=SHARED&sharedMode=ROUTE"><Route aria-hidden="true"/>Shared Shipments</Link>}/>
    <section className="pstl-explanation"><Route aria-hidden="true"/><div><strong>{chain.origin} <ArrowRight aria-hidden="true"/> {chain.destination}</strong><span>Drop one shipment, then pick up near that stop. Confirm timing, cargo fit, price, and every agreement before using this route.</span></div></section>
    <div className="shared-detail-facts">
      <span><Boxes aria-hidden="true"/>{chain.member_count} independent shipments</span>
      <span><Route aria-hidden="true"/>{chain.loaded_distance_km} km carrying shipments</span>
      <span><MapPinned aria-hidden="true"/>{chain.connector_distance_km} km between shipments</span>
    </div>
    <ol className="route-chain">
      {chain.members.map((load:any,index:number)=>{
        const connector=index<chain.connectors.length?chain.connectors[index]:null;
        return <li key={load.id}>
          <LoadBoardCard load={load} canNegotiate={canNegotiate} contextLabel={`Route leg ${index+1}`}/>
          {connector?<div className="route-chain-connector"><ArrowDown aria-hidden="true"/><span>{connector.distance_km===0?'Pickup at this drop-off':`${connector.distance_km} km to next pickup`}</span></div>:null}
        </li>;
      })}
    </ol>
    <p className="meta pstl-footnote"><Boxes aria-hidden="true"/>Candidate only. Shipments remain separate on the Shipment Board and must be negotiated with each owner.</p>
  </div>;
}
