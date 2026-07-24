import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PublicHeader } from '@/components/public-header';
import { getPublicCompany } from '@/lib/repository.js';
import { StatusPill } from '@/components/status-pill';
import { capacityLabel } from '@/lib/domain.js';

export default async function CompanyPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const company:any = getPublicCompany(handle);
  if (!company) notFound();
  const initials = String(company.name || company.business_name).split(' ').slice(0,2).map((v:string)=>v[0]).join('');
  return <><PublicHeader/><main className="section"><div className="container"><div className="company-hero"><div className="company-logo">{initials}</div><div><div style={{display:'flex',gap:9,alignItems:'center',flexWrap:'wrap'}}><h1 className="page-title">{company.name}</h1>{company.verified?<StatusPill status="Approved"/>:null}</div><p className="page-subtitle">{company.headline}</p><div className="meta">{company.city} · {String(company.type).replaceAll('_',' ')}</div></div><div><Link className="button" href="/login">Send business request</Link><a className="button secondary" href={`tel:${company.contact_phone || company.phone || ''}`}>Contact</a></div></div>
  <div className="two-col" style={{marginTop:20}}><div className="stack"><section className="card"><h2 style={{fontSize:'1.45rem'}}>Overview</h2><p className="lede" style={{fontSize:'1rem'}}>{company.about || company.description}</p><h3>Services</h3><p>{company.services || 'Contact the company for current services.'}</p><h3>Routes or corridors</h3><p>{company.corridors || 'Contact the company for current routes.'}</p></section>
  {company.routes?.length?<section className="card"><h2 style={{fontSize:'1.45rem'}}>Routes & centers</h2><div className="stack">{company.routes.map((route:any)=><div className="card" key={route.id}><strong>{route.origin_name} ({route.origin_city}) → {route.destination_name} ({route.destination_city})</strong><div className="meta">{route.service_days || 'Service days by arrangement'} · {route.estimated_time || 'Time confirmed directly'}</div><div style={{marginTop:9,display:'flex',gap:7,flexWrap:'wrap'}}>{route.branch_dropoff?<span className="status">Branch drop-off</span>:null}{route.receiver_pickup?<span className="status green">Receiver pickup</span>:null}{route.direct_delivery?<span className="status purple">Direct delivery</span>:null}</div></div>)}</div></section>:null}
  </div><aside className="stack"><section className="card"><h3>Contact</h3><p>{company.contact_phone || company.phone}</p><p>{company.contact_email || company.email}</p></section>{company.capacities?.length?<section className="card"><h3>Current capacity</h3><div className="stack">{company.capacities.map((cap:any)=><div key={cap.id}><strong>{capacityLabel(cap.status,cap.available_percent)}</strong><div className="meta">{cap.corridor || `${cap.origin} → ${cap.destination}`}</div><div className="meta">Updated by {cap.updated_by_name}, {new Date(cap.updated_at).toLocaleString()}</div>{cap.photo_path?<span className="status green">Capacity photo attached</span>:null}</div>)}</div></section>:null}</aside></div></div></main></>;
}
