import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { PublicHeader } from '@/components/public-header';
import { getPublicCompany } from '@/lib/repository.js';
import { StatusPill } from '@/components/status-pill';
import { capacityLabel } from '@/lib/domain.js';
import { requireUser } from '@/lib/auth';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { VerificationBadges } from '@/components/verification-badges';
import { Building2, Mail, MapPin, Phone, Star, Truck } from 'lucide-react';

export default async function CompanyPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const user=await requireUser();
  const company:any = getPublicCompany(handle);
  if (!company) notFound();
  const isBusiness=Boolean(company.is_business);
  const canSendProviderRequest=!isBusiness&&['SHIPPER','RECEIVER'].includes(user.role);
  const canSelectReceiver=isBusiness&&['SHIPPER','RECEIVER'].includes(user.role)&&company.id!==user.organization_id;
  const providerRef = `${company.page_kind === 'provider' ? 'profile' : 'org'}:${company.id}`;
  const initials = String(company.name || company.business_name).split(' ').slice(0,2).map((v:string)=>v[0]).join('');
  const hasContact=Boolean(company.contact_phone||company.contact_email);

  return <><PublicHeader/><main className="section"><div className="container">
    <div className="company-hero"><div className="company-logo">{initials}</div><div><div className="profile-title-line"><h1 className="page-title">{company.name}</h1>{company.verified?<StatusPill status="Approved"/>:null}</div><p className="page-subtitle">{company.headline}</p><div className="meta icon-meta"><MapPin aria-hidden="true"/>{company.city||'Location not added'} · {isBusiness?'Business':String(company.type).replaceAll('_',' ')}</div><VerificationBadges badges={company.verification_badges}/></div><div className="hero-actions">{canSendProviderRequest?<Link className="button" href={`/app/shipments/new?provider=${providerRef}`}>Send request</Link>:null}{canSelectReceiver?<Link className="button" href={`/app/shipments/new?receiver=${company.id}`}>Create load together</Link>:null}</div></div>

    <div className="two-col" style={{marginTop:20}}><div className="stack">
      <section className="card"><h2>{isBusiness?'About this Business':'Overview'}</h2><p className="lede profile-about">{company.about || company.description || 'Profile information is being completed.'}</p>{company.services?<><h3>{isBusiness?'What this Business makes or distributes':'Services'}</h3><p>{company.services}</p></>:null}{company.operating_regions?<><h3><MapPin aria-hidden="true"/>{isBusiness?'Operating regions and cities':'Service regions and cities'}</h3><p>{company.operating_regions}</p></>:null}{!isBusiness?<><h3>Preferred corridors</h3><p>{company.corridors || 'Contact the transporter for current corridors.'}</p></>:null}</section>

      {!isBusiness?<section className="card"><div className="page-header compact-header"><div><h2>Truck roster</h2><p className="page-subtitle">{company.fleet_size} active {company.fleet_size===1?'truck':'trucks'} registered to this {company.page_kind==='provider'?'owner-operator':'fleet'}.</p></div></div><div className="provider-truck-roster">{company.vehicles.map((vehicle:any)=>{const publicCapacity=company.capacities.find((capacity:any)=>capacity.vehicle_id===vehicle.vehicle_id);const latestFresh=vehicle.capacity_id&&new Date(vehicle.expires_at).getTime()>Date.now();const displayStatus=vehicle.status==='OFF_DUTY'?'OFF_DUTY':latestFresh?vehicle.status:'NOT_UPDATED';return <article className="provider-truck-row" key={vehicle.vehicle_id}><Image src={vehicleConfigurationImage(vehicle.cargo_configuration||vehicle.category)} alt={vehicle.cargo_configuration||vehicle.category} width={100} height={100}/><div><strong>{vehicle.make} · {vehicle.model}</strong><div className="meta">{vehicle.cargo_configuration||vehicle.category} · {vehicle.plate||'Plate not recorded'}</div><VerificationBadges badges={vehicle.verification_badges} compact/></div><StatusPill status={displayStatus}/>{publicCapacity?<Link className="button secondary small" href={`/app/capacity/${publicCapacity.id}`}>Capacity details</Link>:<span className="meta">{displayStatus==='OFF_DUTY'?'Hidden from Capacity Board':'No current Public capacity'}</span>}</article>})}</div></section>:null}
    </div>

    <aside className="stack">
      {isBusiness?<section className="card"><h3><Star aria-hidden="true"/>Business rating</h3><div className="rating-summary"><strong>{company.review_count?`${company.average_rating} / 5`:'New'}</strong><span>{company.review_count||0} completed-load reviews</span></div></section>:<section className="card"><h3><Truck aria-hidden="true"/>Fleet facts</h3><div className="detail-facts single"><div><span>Registered trucks</span><strong>{company.fleet_size}</strong></div><div><span>On Capacity Board</span><strong>{company.capacities.length}</strong></div></div></section>}
      <section className="card"><h3><Building2 aria-hidden="true"/>Public contact</h3>{hasContact?<div className="public-contact-list">{company.contact_phone?<a href={`tel:${company.contact_phone}`}><Phone aria-hidden="true"/>{company.contact_phone}</a>:null}{company.contact_email?<a href={`mailto:${company.contact_email}`}><Mail aria-hidden="true"/>{company.contact_email}</a>:null}</div>:<p className="muted">No public contact added.</p>}<p className="meta">Account login contacts are private and never shown here.</p></section>
      {!isBusiness&&company.capacities?.length?<section className="card"><h3>Current Public capacity</h3><div className="stack">{company.capacities.map((cap:any)=><Link href={`/app/capacity/${cap.id}`} key={cap.id}><strong>{cap.vehicle_make} · {cap.vehicle_model}</strong><div className="meta">{capacityLabel(cap.status,cap.available_percent)}</div><div className="meta">{cap.corridor || `${cap.origin} ↔ ${cap.destination}`}</div></Link>)}</div></section>:null}
    </aside></div>
  </div></main></>;
}
