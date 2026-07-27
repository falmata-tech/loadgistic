import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listProviders } from '@/lib/repository.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { StatusPill } from '@/components/status-pill';

export default async function ProvidersPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 await requireUser(['SHIPPER','RECEIVER','ADMIN']); const query=await searchParams; const type=query.type||'ALL'; const providers:any[]=listProviders(type);
 return <div className="page"><PageHeader title="Find transporters" subtitle="Discover fleet transporters and self-managed drivers with real registered trucks."/><Flash error={query.error} success={query.success}/><div className="hero-actions" style={{margin:'0 0 20px'}}>{[['ALL','All'],['TRANSPORT','Fleet Transporters'],['DRIVER','Self-managed Drivers']].map(([v,l])=><Link className={`button ${type===v?'':'secondary'}`} href={`/app/providers?type=${v}`} key={v}>{l}</Link>)}</div><div className="grid-3">{providers.map((p:any)=><article className="card" key={`${p.ref_kind}-${p.id}`}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><span className="status">{p.type.replaceAll('_',' ')}</span>{p.verified?<StatusPill status="Approved"/>:null}</div><h3 style={{fontSize:'1.25rem',marginTop:14}}>{p.name}</h3><p className="muted">{p.about}</p><p><strong>Preferred corridors:</strong><br/>{p.corridors||'Contact transporter'}</p><div className="provider-facts"><div><span>Registered trucks</span><strong>{p.fleet_size}</strong></div><div><span>On Capacity Board</span><strong>{p.active_capacity_count}</strong></div></div><div className="hero-actions"><Link href={`/companies/${p.handle}`} className="button secondary">View Public Profile</Link><Link href={`/app/shipments/new?provider=${p.ref_kind}:${p.id}`} className="button">Send request</Link></div></article>)}</div></div>;
}
