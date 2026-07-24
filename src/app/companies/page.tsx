import { PublicHeader } from '@/components/public-header';
import Link from 'next/link';
import { listProviders } from '@/lib/repository.js';
import { StatusPill } from '@/components/status-pill';
import { capacityLabel } from '@/lib/domain.js';

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string,string | undefined>> }) {
  const query = await searchParams;
  const kind = query.type || 'ALL';
  const providers = listProviders(kind);
  return <><PublicHeader/><main className="section"><div className="container"><div className="page-header"><div><h1 className="page-title">Company directory</h1><p className="page-subtitle">Discover parcel delivery companies, transport companies, and independent providers.</p></div></div>
    <div className="hero-actions" style={{margin:'0 0 24px'}}>{[['ALL','All'],['PARCEL','Parcel Delivery'],['TRANSPORT','Transport Companies'],['DRIVER','Independent Providers']].map(([value,label])=><Link key={value} className={`button ${kind===value?'':'secondary'}`} href={`/companies?type=${value}`}>{label}</Link>)}</div>
    <div className="grid-3">{providers.map((provider:any)=><article className="card" key={`${provider.ref_kind}-${provider.id}`}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><span className="status">{provider.type.replaceAll('_',' ')}</span>{provider.verified?<StatusPill status="Approved"/>:null}</div><h3 style={{marginTop:14,fontSize:'1.25rem'}}>{provider.name}</h3><p className="muted">{provider.about}</p><div className="meta"><strong>Routes / corridors:</strong> {provider.corridors || 'Contact provider'}</div>{provider.centers?<div className="meta" style={{marginTop:8}}><strong>Centers:</strong> {provider.centers}</div>:null}{provider.capacity?<div className="alert success" style={{marginTop:14,marginBottom:0}}>{capacityLabel(provider.capacity.status,provider.capacity.available_percent)}<br/><span className="meta">Updated {new Date(provider.capacity.updated_at).toLocaleString()}</span></div>:null}<div className="hero-actions"><Link className="button secondary" href={`/companies/${provider.handle}`}>View company</Link><Link className="button" href="/login">Send request</Link></div></article>)}</div>
  </div></main></>;
}
