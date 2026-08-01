import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowDown, ArrowRight, Boxes, CalendarClock, Eye, MapPinned, Route } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAlongRouteLoad } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { priceDisplay } from '@/lib/ui';

export default async function AlongRouteLoadPage({params}:{params:Promise<{id:string}>}){
  const user=await requireUser(['TRANSPORTER','DRIVER','ADMIN']);
  const {id}=await params;
  const chain:any=getAlongRouteLoad(user,id);
  if(!chain)notFound();
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
          <article className="card route-chain-leg">
            <div className="route-chain-number">{index+1}</div>
            <div className="route-chain-content">
              <div className="status-row"><span className="status green">{load.load_type}</span><span className="status">{load.shipper_name}</span>{load.interested?<span className="status green">Interest sent</span>:null}</div>
              <h2>{load.title}</h2>
              <div className="route">{load.origin}<ArrowRight aria-hidden="true"/>{load.destination}</div>
              <p>{load.cargo_description}</p>
              <div className="meta"><CalendarClock aria-hidden="true"/>Pick up before {load.pickup_date||'Not set'}{load.delivery_date?` · Drop off before ${load.delivery_date}`:''}</div>
            </div>
            <div className="load-board-actions"><strong>{priceDisplay(load)}</strong><Link className="button secondary icon-button-label" href={`/app/shipments/${load.id}`}><Eye aria-hidden="true"/>Open shipment</Link></div>
          </article>
          {connector?<div className="route-chain-connector"><ArrowDown aria-hidden="true"/><span>{connector.distance_km===0?'Pickup at this drop-off':`${connector.distance_km} km to next pickup`}</span></div>:null}
        </li>;
      })}
    </ol>
    <p className="meta pstl-footnote"><Boxes aria-hidden="true"/>Candidate only. Shipments remain separate on the Shipment Board and must be negotiated with each owner.</p>
  </div>;
}
