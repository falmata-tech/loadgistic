import { PublicHeader } from '@/components/public-header';
import Link from 'next/link';
import { listDirectoryProfiles } from '@/lib/repository.js';
import { StatusPill } from '@/components/status-pill';
import { requireUser } from '@/lib/auth';

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string,string | undefined>> }) {
  const query = await searchParams;
  await requireUser();
  const kind = query.type || 'ALL';
  const search = String(query.q || '').trim().toLowerCase();
  const providers = listDirectoryProfiles(kind).filter((profile:any) => !search || [profile.name,profile.city,profile.operating_regions,profile.about,profile.services,profile.corridors].some(value => String(value || '').toLowerCase().includes(search)));
  return <><PublicHeader/><main className="section"><div className="container"><div className="page-header"><div><h1 className="page-title">Business and Transporter Directory</h1><p className="page-subtitle">Confirm Businesses, fleet transporters, and self-managed drivers after login.</p></div></div>
    <form className="board-filter-bar" method="get"><div className="form-group"><label htmlFor="companies-search">Search members or locations</label><input id="companies-search" name="q" defaultValue={query.q||''} placeholder="Business, city, product, or corridor"/></div><input type="hidden" name="type" value={kind}/><button className="button">Search</button>{search?<Link href={`/companies?type=${kind}`} className="button secondary">Clear</Link>:null}</form>
    <div className="hero-actions" style={{margin:'0 0 24px'}}>{[['ALL','All'],['BUSINESS','Businesses'],['TRANSPORT','Fleet Transporters'],['DRIVER','Self-managed Drivers']].map(([value,label])=><Link key={value} className={`button ${kind===value?'':'secondary'}`} href={`/companies?type=${value}${query.q?`&q=${encodeURIComponent(query.q)}`:''}`}>{label}</Link>)}</div>
    <div className="grid-3">{providers.map((provider:any)=><article className="card" key={`${provider.ref_kind}-${provider.id}`}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><span className="status">{provider.is_business?'BUSINESS':provider.type.replaceAll('_',' ')}</span>{provider.verified?<StatusPill status="Approved"/>:null}</div><h3 style={{marginTop:14,fontSize:'1.25rem'}}>{provider.name}</h3><p className="muted">{provider.about}</p>{provider.operating_regions?<div className="meta"><strong>{provider.is_business?'Operating areas':'Service areas'}:</strong> {provider.operating_regions}</div>:null}{!provider.is_business?<><div className="meta"><strong>Preferred corridors:</strong> {provider.corridors || 'Contact transporter'}</div><div className="provider-facts"><div><span>Registered trucks</span><strong>{provider.fleet_size}</strong></div><div><span>On Capacity Board</span><strong>{provider.active_capacity_count}</strong></div></div></>:<div className="meta">{provider.review_count?`${provider.average_rating} / 5 from ${provider.review_count} completed-load reviews`:'No completed-load reviews yet'}</div>}<div className="hero-actions"><Link className="button secondary" href={`/companies/${provider.handle}`}>View Profile</Link></div></article>)}</div>{!providers.length?<div className="empty-state">No directory members match this search.</div>:null}
  </div></main></>;
}
