import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Building2, CircleDotDashed, ExternalLink, Gauge, Mail, MapPin, MessageCircle, Phone, Route, ShieldCheck, Star, Truck } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { ProviderIntroVideo } from '@/components/provider-intro-video';
import { VerificationBadges } from '@/components/verification-badges';
import { getPublicProvider } from '@/lib/repository.js';

export const dynamic='force-dynamic';

export default async function ProviderPage({params}:{params:Promise<{handle:string}>}){
  const {handle}=await params;
  const provider:any=getPublicProvider(handle);
  if(!provider)notFound();
  const style={'--provider-primary':provider.theme_primary||'#075985','--provider-accent':provider.theme_accent||'#f97316'} as any;
  const corridors=new Map<string,any>();
  for(const capacity of provider.capacities)for(const corridor of capacity.recurring_corridors||[])corridors.set(corridor.id,corridor);

  return <><PublicHeader/><main className="provider-microsite" style={style}>
    <section className="provider-site-hero"><div className="container provider-site-hero-grid">
      <div className="provider-site-mark">{provider.name.split(/\s+/).slice(0,2).map((part:string)=>part[0]).join('')}</div>
      <div><span className="provider-handle">/@{provider.handle}</span><h1>{provider.name}</h1><p>{provider.headline||'Road freight capacity and transport service'}</p><div className="provider-hero-facts">{provider.city?<span><MapPin aria-hidden="true"/>{provider.city}</span>:null}<span><Truck aria-hidden="true"/>{provider.vehicles.length} active {provider.vehicles.length===1?'truck':'trucks'}</span><span><Star aria-hidden="true"/>{provider.review_count?`${provider.average_rating} · ${provider.review_count} verified shipment ${provider.review_count===1?'review':'reviews'}`:'New provider'}</span></div></div>
      <div className="provider-public-contacts">{provider.contact_phone?<a href={`tel:${provider.contact_phone}`}><Phone aria-hidden="true"/>Call {provider.contact_phone}</a>:null}{provider.contact_whatsapp?<a href={`https://wa.me/${String(provider.contact_whatsapp).replace(/\D/g,'')}`}><MessageCircle aria-hidden="true"/>WhatsApp</a>:null}{provider.contact_email?<a href={`mailto:${provider.contact_email}`}><Mail aria-hidden="true"/>Email</a>:null}{provider.contact_website?<a href={provider.contact_website} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true"/>Website</a>:null}</div>
    </div></section>
    <div className="container provider-site-layout"><div className="provider-site-main">
      <section className="provider-site-section"><h2><Building2 aria-hidden="true"/>About {provider.name}</h2><p className="lede">{provider.about||`${provider.name} provides road-freight services and publishes current truck availability on Loadgistic.`}</p>{provider.services?<><h3>Services</h3><p>{provider.services}</p></>:null}</section>
      {provider.youtube_video_id?<section className="provider-site-section"><ProviderIntroVideo videoId={provider.youtube_video_id} providerName={provider.name}/></section>:null}
      <section className="provider-site-section"><div className="section-title-row"><h2><Gauge aria-hidden="true"/>Trucks available now</h2><Link href="/">Explore all available trucks</Link></div>{provider.capacities.length?<div className="provider-capacity-list">{provider.capacities.map((item:any)=><article key={item.id}><span className={`signal-chip ${item.availability_geometry==='ROUTE'?'route':'radius'}`}>{item.availability_geometry==='ROUTE'?<Route aria-hidden="true"/>:<CircleDotDashed aria-hidden="true"/>}{item.availability_geometry==='ROUTE'?'Current corridor':'Current radius'}</span><h3>{item.vehicle_make} {item.vehicle_model}</h3><p>{item.availability_geometry==='ROUTE'?`${item.current_route_origin} → ${item.current_route_destination}`:`${item.location_area||'Current service area'} · ${item.work_radius_km||50} km radius`}</p><strong>{item.status==='EMPTY'?'Empty':`${item.available_percent}% open`}</strong></article>)}</div>:<div className="empty-state">No trucks are listed as available right now.</div>}</section>
      {corridors.size?<section className="provider-site-section"><h2><Route aria-hidden="true"/>Regular corridors</h2><div className="provider-corridor-list">{[...corridors.values()].slice(0,2).map(corridor=><div key={corridor.id}><strong>{corridor.origin} ↔ {corridor.destination}</strong><span>Two-way regular corridor · confirm current availability</span></div>)}</div></section>:null}
      <section className="provider-site-section"><h2><Star aria-hidden="true"/>Customer reviews</h2>{provider.reviews.length?<div className="provider-review-list">{provider.reviews.map((review:any,index:number)=><article key={`${review.created_at}-${index}`}><strong>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</strong>{review.note?<p>{review.note}</p>:null}<span>Verified completed shipment · {new Date(review.created_at).toLocaleDateString()}</span>{review.dispute_status==='PENDING'?<small>Provider dispute under review · rating remains published and counted</small>:null}</article>)}</div>:<p className="muted">No verified shipment reviews yet.</p>}</section>
    </div><aside className="provider-site-aside">
      <section><h2><ShieldCheck aria-hidden="true"/>Document badges</h2><VerificationBadges badges={provider.verification_badges}/><p>Badges show which documents Loadgistic has reviewed. Check current originals, permits, the Driver, truck authorization, cargo fit, and terms before agreeing.</p></section>
      <section><h2><Truck aria-hidden="true"/>Fleet</h2>{provider.vehicles.map((vehicle:any)=><div className="provider-fleet-row" key={vehicle.platform_number}><Truck aria-hidden="true"/><span><strong>{vehicle.make} {vehicle.model}</strong><small>{vehicle.platform_number} · {vehicle.cargo_configuration}</small></span></div>)}</section>
    </aside></div>
  </main></>;
}
