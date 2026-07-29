import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getNetworkState, getProfileRouteComparison, getPublicCompany } from '@/lib/repository.js';
import { StatusPill } from '@/components/status-pill';
import { capacityLabel } from '@/lib/domain.js';
import { requireUser } from '@/lib/auth';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { VerificationBadges } from '@/components/verification-badges';
import { RouteCoverageMap } from '@/components/route-coverage-map';
import { Building2, GitCompareArrows, Mail, MapPin, Phone, Route, Star, Truck } from 'lucide-react';
import { NetworkActions } from '@/components/network-actions';
import { Flash } from '@/components/flash';

export default async function CompanyPage({ params,searchParams }: { params: Promise<{ handle: string }>; searchParams:Promise<Record<string,string|undefined>> }) {
  const { handle } = await params;
  const query=await searchParams;
  const user=await requireUser();
  const company:any = getPublicCompany(handle);
  if (!company) notFound();
  const comparison=query.compare==='routes'?getProfileRouteComparison(user,company):null;
  const isBusiness=Boolean(company.is_business);
  const canSendProviderRequest=!isBusiness&&['SHIPPER','RECEIVER'].includes(user.role);
  const canSelectReceiver=isBusiness&&['SHIPPER','RECEIVER'].includes(user.role)&&company.id!==user.organization_id;
  const isOwnProfile=(company.page_kind==='organization'&&company.id===user.organization_id)||(company.page_kind==='provider'&&company.id===user.provider_profile_id);
  const providerRef = `${company.page_kind === 'provider' ? 'profile' : 'org'}:${company.id}`;
  const initials = String(company.name || company.business_name).split(' ').slice(0,2).map((v:string)=>v[0]).join('');
  const hasContact=Boolean(company.contact_phone||company.contact_email);

  const networkState=getNetworkState(user,company.page_kind==='provider'?'profile':'org',company.id);
  return <div className="page"><Flash error={query.error} success={query.success}/>
    <div className="company-hero"><div className="company-logo">{initials}</div><div><div className="profile-title-line"><h1 className="page-title">{company.name}</h1>{company.verified?<StatusPill status="Approved"/>:null}</div><p className="page-subtitle">{company.headline}</p><div className="meta icon-meta"><MapPin aria-hidden="true"/>{company.city||'Location not added'} · {isBusiness?'Business':String(company.type).replaceAll('_',' ')}</div><VerificationBadges badges={company.verification_badges}/></div><div className="hero-actions">{canSendProviderRequest?<Link className="button" href={`/app/shipments/new?provider=${providerRef}`}>Send request</Link>:null}{canSelectReceiver?<Link className="button" href={`/app/shipments/new?receiver=${company.id}`}>Create load together</Link>:null}{!isOwnProfile&&company.map_routes.length?<Link className="button secondary icon-button-label" href={`/app/providers/${handle}?compare=routes#route-coverage`}><GitCompareArrows aria-hidden="true"/>Compare routes</Link>:null}<NetworkActions state={networkState} targetKind={company.page_kind==='provider'?'profile':'org'} targetId={company.id} returnTo={`/app/providers/${handle}`}/></div></div>

    <div className="two-col" style={{marginTop:20}}><div className="stack">
	      <section className="card profile-overview"><h2>{isBusiness?'About this Business':'Overview'}</h2><p className="lede profile-about">{company.about || company.description || 'Profile information is being completed.'}</p>{company.services?<><h3>{isBusiness?'What this Business makes or distributes':'Services'}</h3><p>{company.services}</p></>:null}{company.operating_regions?<><h3><MapPin aria-hidden="true"/>{isBusiness?'Operating regions and cities':'Service regions and cities'}</h3><p>{company.operating_regions}</p></>:null}</section>

      <section className="card profile-route-coverage" id="route-coverage"><div className="page-header compact-header"><div><h2><Route aria-hidden="true"/>{isBusiness?'Freight Routes':'Preferred Routes'}</h2><p className="page-subtitle">{isBusiness?'Declared Business routes are shown separately from recorded activity.':'Stable Preferred Routes are shown with fresh, expiring truck routes when available.'}</p></div>{comparison?<Link className="button secondary small" href={`/app/providers/${handle}#route-coverage`}>Hide comparison</Link>:null}</div>
        {comparison?<div className="route-comparison-summary"><div><span>Route fit</span><strong>{comparison.strongest_label}</strong></div><div><span>Evidence</span><strong>{comparison.evidence_label}</strong></div><div><span>Shared view</span><strong>{comparison.exact_count} full · {comparison.partial_count} partial</strong></div></div>:null}
        {company.map_routes.length?<RouteCoverageMap routes={company.map_routes} comparisonRoutes={comparison?.viewer_routes||[]}/>:null}
        {company.routes.length?<div className="profile-route-evidence">{company.routes.map((route:any)=><article key={route.id}><div><strong>{route.origin}<span>↔</span>{route.destination}</strong><small>{route.evidence_label}</small></div><dl><div><dt>{isBusiness?'Loads posted':'Capacity reports'}</dt><dd>{route.reported_count}</dd></div><div><dt>Tracked shipments</dt><dd>{route.tracked_count}</dd></div></dl></article>)}</div>:<div className="empty-state">No {isBusiness?'Freight':'Preferred'} Routes declared yet.</div>}
        {!isBusiness&&company.live_routes.length?<div className="live-route-list"><h3>Fresh truck routes</h3>{company.live_routes.map((route:any)=><article key={route.id}><div><span className={`status ${route.route_kind==='CURRENT_PARTIAL'?'green':''}`}>{route.source_label}</span><strong>{route.origin} → {route.destination}</strong><small>{route.platform_number} · {route.route_date} · {route.planned_space_status==='FULL'?'Full':'Partial'} cargo space</small></div><span className="meta">Expires {new Date(route.expires_at).toLocaleString()}</span></article>)}</div>:null}
        {comparison?<div className="comparison-explanation"><strong>How this comparison works</strong><p>Full matches share both city endpoints in either direction. Partial matches share one endpoint. Counts come from this profile's records; declarations without supporting records remain clearly labeled.</p>{comparison.matches.filter((match:any)=>match.score>0).length?<div className="comparison-match-list">{comparison.matches.filter((match:any)=>match.score>0).map((match:any,index:number)=><div key={`${match.target.id}-${index}`}><StatusPill status={match.score===2?'FULL_MATCH':'PARTIAL_MATCH'}/><span>{match.viewer.origin} ↔ {match.viewer.destination}</span><strong>{match.target.origin} ↔ {match.target.destination}</strong></div>)}</div>:<p className="meta">No endpoint overlap was found. This does not mean either member cannot serve the other.</p>}</div>:null}
      </section>

      {!isBusiness?<section className="card"><div className="page-header compact-header"><div><h2>Truck roster</h2><p className="page-subtitle">{company.fleet_size} active {company.fleet_size===1?'truck':'trucks'} registered to this {company.page_kind==='provider'?'owner-operator':'fleet'}.</p></div></div><div className="provider-truck-roster">{company.vehicles.map((vehicle:any)=>{const publicCapacity=company.capacities.find((capacity:any)=>capacity.vehicle_id===vehicle.vehicle_id);const latestFresh=vehicle.capacity_id&&new Date(vehicle.expires_at).getTime()>Date.now();const displayStatus=vehicle.status==='OFF_DUTY'?'OFF_DUTY':latestFresh?vehicle.status:'NOT_UPDATED';return <article className="provider-truck-row" key={vehicle.vehicle_id}><Image src={vehicleConfigurationImage(vehicle.cargo_configuration||vehicle.category)} alt={vehicle.cargo_configuration||vehicle.category} width={100} height={100}/><div><strong>{vehicle.make} · {vehicle.model}</strong><div className="meta">{vehicle.platform_number} · {vehicle.cargo_configuration||vehicle.category}</div><VerificationBadges badges={vehicle.verification_badges} compact/></div><StatusPill status={displayStatus}/>{publicCapacity?<Link className="button secondary small" href={`/app/capacity/${publicCapacity.id}`}>Capacity details</Link>:<span className="meta">{displayStatus==='OFF_DUTY'?'Hidden from Capacity Board':'No current Public capacity'}</span>}</article>})}</div></section>:null}
    </div>

    <aside className="stack">
      {isBusiness?<section className="card"><h3><Star aria-hidden="true"/>Business rating</h3><div className="rating-summary"><strong>{company.review_count?`${company.average_rating} / 5`:'New'}</strong><span>{company.review_count||0} completed-load reviews</span></div></section>:<section className="card"><h3><Truck aria-hidden="true"/>Fleet facts</h3><div className="detail-facts single"><div><span>Registered trucks</span><strong>{company.fleet_size}</strong></div><div><span>On Capacity Board</span><strong>{company.capacities.length}</strong></div></div></section>}
      <section className="card"><h3><Building2 aria-hidden="true"/>Public contact</h3>{hasContact?<div className="public-contact-list">{company.contact_phone?<a href={`tel:${company.contact_phone}`}><Phone aria-hidden="true"/>{company.contact_phone}</a>:null}{company.contact_email?<a href={`mailto:${company.contact_email}`}><Mail aria-hidden="true"/>{company.contact_email}</a>:null}</div>:<p className="muted">No public contact added.</p>}<p className="meta">Account login contacts are private and never shown here.</p></section>
      {!isBusiness&&company.capacities?.length?<section className="card"><h3>Current Public capacity</h3><div className="stack">{company.capacities.map((cap:any)=><Link href={`/app/capacity/${cap.id}`} key={cap.id}><strong>{cap.vehicle_make} · {cap.vehicle_model}</strong><div className="meta">{cap.platform_number} · {capacityLabel(cap.status,cap.available_percent)}</div><div className="meta">{cap.status==='PARTIAL'&&cap.current_route_origin?`${cap.current_route_origin} → ${cap.current_route_destination}`:cap.origin&&cap.destination?`${cap.origin} → ${cap.destination}`:'Route not recorded'}</div></Link>)}</div></section>:null}
    </aside></div>
  </div>;
}
