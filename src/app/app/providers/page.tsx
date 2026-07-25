import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listProviders } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';
import { capacityLabel } from '@/lib/domain.js';

export default async function ProvidersPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 await requireUser(['SHIPPER','RECEIVER','ADMIN']); const query=await searchParams; const type=query.type||'ALL'; const providers:any[]=listProviders(type);
 return <div className="page"><PageHeader title="Find providers" subtitle="Discover parcel delivery companies, transport companies, and independent providers."/><Flash error={query.error} success={query.success}/><div className="hero-actions" style={{margin:'0 0 20px'}}>{[['ALL','All'],['PARCEL','Parcel Delivery'],['TRANSPORT','Transport Companies'],['DRIVER','Independent Providers']].map(([v,l])=><Link className={`button ${type===v?'':'secondary'}`} href={`/app/providers?type=${v}`} key={v}>{l}</Link>)}</div><div className="grid-3">{providers.map((p:any)=><article className="card" key={`${p.ref_kind}-${p.id}`}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><span className="status">{p.type.replaceAll('_',' ')}</span>{p.verified?<StatusPill status="Approved"/>:null}</div><h3 style={{fontSize:'1.25rem',marginTop:14}}>{p.name}</h3><p className="muted">{p.about}</p><p><strong>Routes / corridors:</strong><br/>{p.corridors||'Contact provider'}</p>{p.centers?<p><strong>Centers:</strong><br/>{p.centers}</p>:null}{p.capacity?<div className="alert success"><strong>{capacityLabel(p.capacity.status,p.capacity.available_percent)}</strong><div className="meta">{p.capacity.corridor} · updated {new Date(p.capacity.updated_at).toLocaleString()}</div></div>:null}<div className="hero-actions"><Link href={`/companies/${p.handle}`} className="button secondary">View company</Link><Link href={`/app/shipments/new?provider=${p.ref_kind}:${p.id}`} className="button">Send request</Link></div></article>)}</div></div>;
}
