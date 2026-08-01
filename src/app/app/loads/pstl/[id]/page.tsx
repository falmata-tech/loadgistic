import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, CircleDotDashed, Eye, Layers3, Route } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getPooledLoad, paginateResults } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { priceDisplay } from '@/lib/ui';

export default async function PooledLoadPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['TRANSPORTER','DRIVER','ADMIN']);
  const {id}=await params;
  const query=await searchParams;
  const pool:any=getPooledLoad(user,id);
  if(!pool)notFound();
  const memberResult:any=paginateResults(pool.members,{page:query.page,pageSize:12});
  return <div className="page">
    <PageHeader icon={Layers3} title="Pool together" subtitle={`${pool.member_count} compatible PTL shipments`} action={<Link className="button secondary icon-button-label" href="/app/loads?board=SHARED"><Layers3 aria-hidden="true"/>Shared Shipments</Link>}/>
    <section className="pstl-explanation"><Route aria-hidden="true"/><div><strong>{pool.origin} area → {pool.destination} area</strong><span>Every origin and destination is close to every other one in this candidate. Confirm cargo fit, timing, price, and each agreement separately.</span></div></section>
    <div className="shared-detail-facts">
      <span><CircleDotDashed aria-hidden="true"/>Origins within {pool.origin_spread_km} km</span>
      <span><CircleDotDashed aria-hidden="true"/>Destinations within {pool.destination_spread_km} km</span>
    </div>
    <div className="stack">
      {memberResult.items.map((load:any)=><article className="card pooled-member" key={load.id}>
        <div><div className="status-row"><span className="status green">PTL</span><span className="status">{load.shipper_name}</span>{load.interested?<span className="status green">Interest sent</span>:null}</div><h3>{load.title}</h3><div className="route">{load.origin}<span>→</span>{load.destination}</div><p>{load.cargo_description}</p><div className="meta">Pick up before {load.pickup_date}{load.delivery_date?` · Drop off before ${load.delivery_date}`:''}</div></div>
        <div className="load-board-actions"><strong>{priceDisplay(load)}</strong><Link className="button secondary icon-button-label" href={`/app/shipments/${load.id}`}><Eye aria-hidden="true"/>Open shipment</Link></div>
      </article>)}
    </div>
    <Pagination path={`/app/loads/pstl/${id}`} query={{}} page={memberResult.page} pageCount={memberResult.pageCount} total={memberResult.total}/>
    <p className="meta pstl-footnote"><Boxes aria-hidden="true"/>Candidate only. Original shipments remain independent and unchanged on the Shipment Board.</p>
  </div>;
}
