import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, CircleDotDashed, Layers3, Route } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getDriverAccess, getPooledLoad, paginateResults } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { LoadBoardCard } from '@/components/load-board-card';

export default async function PooledLoadPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(['TRANSPORTER','DRIVER','ADMIN']);
  const {id}=await params;
  const query=await searchParams;
  const pool:any=await getPooledLoad(user,id);
  if(!pool)notFound();
  const access=await getDriverAccess(user);
  const canNegotiate=access?.can_negotiate_loads!==false&&access?.can_contact_businesses!==false;
  const memberResult:any=await paginateResults(pool.members,{page:query.page,pageSize:12});
  return <div className="page">
    <PageHeader icon={Layers3} title="Pool together" subtitle={`${pool.member_count} compatible Partial Truckload shipments`} action={<Link className="button secondary icon-button-label" href="/app/loads?board=SHARED"><Layers3 aria-hidden="true"/>Shared Shipments</Link>}/>
    <section className="pstl-explanation"><Route aria-hidden="true"/><div><strong>{pool.origin} area → {pool.destination} area</strong><span>Every origin and destination is close to every other one in this candidate. Confirm cargo fit, timing, price, and each agreement separately.</span></div></section>
    <div className="shared-detail-facts">
      <span><CircleDotDashed aria-hidden="true"/>Origins within {pool.origin_spread_km} km</span>
      <span><CircleDotDashed aria-hidden="true"/>Destinations within {pool.destination_spread_km} km</span>
    </div>
    <div className="stack">
      {memberResult.items.map((load:any)=><LoadBoardCard key={load.id} load={load} canNegotiate={canNegotiate} contextLabel="Pool member"/>)}
    </div>
    <Pagination path={`/app/loads/pstl/${id}`} query={{}} page={memberResult.page} pageCount={memberResult.pageCount} total={memberResult.total}/>
    <p className="meta pstl-footnote"><Boxes aria-hidden="true"/>Candidate only. Original shipments remain independent and unchanged on the Shipment Board.</p>
  </div>;
}
