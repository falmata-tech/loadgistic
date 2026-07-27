import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { PublicHeader } from '@/components/public-header';
import { getPublicCompany } from '@/lib/repository.js';
import { StatusPill } from '@/components/status-pill';
import { capacityLabel } from '@/lib/domain.js';
import { requireUser } from '@/lib/auth';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';

export default async function CompanyPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  await requireUser();
  const company:any = getPublicCompany(handle);
  if (!company) notFound();
  const canReceiveRequests = ['TRANSPORT_COMPANY','INDEPENDENT_PROVIDER'].includes(company.type);
  const providerRef = `${company.page_kind === 'provider' ? 'profile' : 'org'}:${company.id}`;
  const requestHref = `/app/shipments/new?provider=${providerRef}`;
  const initials = String(company.name || company.business_name).split(' ').slice(0,2).map((v:string)=>v[0]).join('');
  return <><PublicHeader/><main className="section"><div className="container"><div className="company-hero"><div className="company-logo">{initials}</div><div><div style={{display:'flex',gap:9,alignItems:'center',flexWrap:'wrap'}}><h1 className="page-title">{company.name}</h1>{company.verified?<StatusPill status="Approved"/>:null}</div><p className="page-subtitle">{company.headline}</p><div className="meta">{company.city} · {String(company.type).replaceAll('_',' ')}</div></div><div>{canReceiveRequests?<Link className="button" href={requestHref}>Send business request</Link>:null}<a className="button secondary" href={`tel:${company.contact_phone || company.phone || ''}`}>Contact</a></div></div>
  <div className="two-col" style={{marginTop:20}}><div className="stack"><section className="card"><h2 style={{fontSize:'1.45rem'}}>Overview</h2><p className="lede" style={{fontSize:'1rem'}}>{company.about || company.description}</p><h3>Services</h3><p>{company.services || 'Contact the transporter for current services.'}</p><h3>Preferred corridors</h3><p>{company.corridors || 'Contact the transporter for current corridors.'}</p></section>
  <section className="card"><div className="page-header compact-header"><div><h2>Truck roster</h2><p className="page-subtitle">{company.fleet_size} active {company.fleet_size===1?'truck':'trucks'} registered to this {company.page_kind==='provider'?'owner-operator':'fleet'}.</p></div></div><div className="provider-truck-roster">{company.vehicles.map((vehicle:any)=>{const publicCapacity=company.capacities.find((capacity:any)=>capacity.vehicle_id===vehicle.vehicle_id);const latestFresh=vehicle.capacity_id&&new Date(vehicle.expires_at).getTime()>Date.now();const displayStatus=vehicle.status==='OFF_DUTY'?'OFF_DUTY':latestFresh?vehicle.status:'NOT_UPDATED';return <article className="provider-truck-row" key={vehicle.vehicle_id}><Image src={vehicleConfigurationImage(vehicle.cargo_configuration||vehicle.category)} alt="" width={100} height={100}/><div><strong>{vehicle.make} · {vehicle.model}</strong><div className="meta">{vehicle.cargo_configuration||vehicle.category} · {vehicle.plate||'Plate not recorded'}</div></div><StatusPill status={displayStatus}/>{publicCapacity?<Link className="button secondary small" href={`/app/capacity/${publicCapacity.id}`}>Capacity details</Link>:<span className="meta">{displayStatus==='OFF_DUTY'?'Hidden from Capacity Board':'No current Public capacity'}</span>}</article>})}</div></section>
  </div><aside className="stack"><section className="card"><h3>Fleet facts</h3><div className="detail-facts single"><div><span>Registered trucks</span><strong>{company.fleet_size}</strong></div><div><span>On Capacity Board</span><strong>{company.capacities.length}</strong></div></div></section><section className="card"><h3>Contact</h3><p>{company.contact_phone || company.phone}</p><p>{company.contact_email || company.email}</p></section>{company.capacities?.length?<section className="card"><h3>Current Public capacity</h3><div className="stack">{company.capacities.map((cap:any)=><Link href={`/app/capacity/${cap.id}`} key={cap.id}><strong>{cap.vehicle_make} · {cap.vehicle_model}</strong><div className="meta">{capacityLabel(cap.status,cap.available_percent)}</div><div className="meta">{cap.corridor || `${cap.origin} ↔ ${cap.destination}`}</div></Link>)}</div></section>:null}</aside></div></div></main></>;
}
