import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, Eye, Layers3, Route } from 'lucide-react';
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
    <PageHeader title="Pooled shared truckload" subtitle={`${pool.member_count} compatible PTL loads near one route`} action={<Link className="button secondary icon-button-label" href="/app/loads?board=POOLED"><Layers3 aria-hidden="true"/>Pooled board</Link>}/>
    <section className="pstl-explanation"><Route aria-hidden="true"/><div><strong>{pool.origin} → {pool.destination}</strong><span>This is a planning view, not one combined agreement. Multi Pick and Multi Drop may be required, and every owner must be contacted separately.</span></div></section>
    <div className="stack">
      {memberResult.items.map((load:any)=><article className="card pooled-member" key={load.id}>
        <div><div className="status-row"><span className="status green">PTL</span><span className="status">{load.shipper_name}</span>{load.interested?<span className="status green">Interest sent</span>:null}</div><h3>{load.title}</h3><div className="route">{load.origin}<span>→</span>{load.destination}</div><p>{load.cargo_description}</p><div className="meta">Pick up before {load.pickup_date}{load.delivery_date?` · Drop off before ${load.delivery_date}`:''}</div></div>
        <div className="load-board-actions"><strong>{priceDisplay(load)}</strong><Link className="button secondary icon-button-label" href={`/app/shipments/${load.id}`}><Eye aria-hidden="true"/>Open load</Link></div>
      </article>)}
    </div>
    <Pagination path={`/app/loads/pstl/${id}`} query={{}} page={memberResult.page} pageCount={memberResult.pageCount} total={memberResult.total}/>
    <p className="meta pstl-footnote"><Boxes aria-hidden="true"/>Original loads remain independent and unchanged on the Load Board.</p>
  </div>;
}
