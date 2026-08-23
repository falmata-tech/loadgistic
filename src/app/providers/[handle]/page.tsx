import {notFound} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,Building2,ExternalLink,Mail,MapPin,MessageCircle,Phone,Route,ShieldCheck,Star,Truck} from 'lucide-react';
import {PublicHeader} from '@/components/public-header';
import {ProviderIntroVideo} from '@/components/provider-intro-video';
import {ProviderFleetShowcase} from '@/components/provider-fleet-showcase';
import {VerificationBadges} from '@/components/verification-badges';
import {getPublicProvider} from '@/lib/repository.js';

export const dynamic='force-dynamic';

export default async function ProviderPage({params}:{params:Promise<{handle:string}>}){
  const {handle}=await params;
  const provider:any=getPublicProvider(handle);
  if(!provider)notFound();
  const corridors=new Map<string,any>();
  for(const capacity of provider.capacities)for(const corridor of capacity.recurring_corridors||[])corridors.set(corridor.id,corridor);
  return <><PublicHeader/><main className="provider-microsite provider-microsite-v2">
    <div className="container provider-site-back"><Link href={`/?q=${encodeURIComponent(provider.name)}`}><ArrowLeft aria-hidden="true"/>Back to Truck Market</Link></div>
    <section className="provider-site-hero"><div className="container provider-site-hero-grid">
      <img className="provider-site-mark provider-profile-image" src={provider.profile_image_url||'/marketing/default-transporter-profile.png'} alt={provider.profile_image_url?`${provider.name} transporter profile`:`Default transporter portrait for ${provider.name}`}/>
      <div className="provider-site-identity"><span className="provider-handle">{provider.provider_kind_label} · /@{provider.handle}</span><h1>{provider.name}</h1><p>{provider.headline||'Professional road-freight services across Ethiopia'}</p><div className="provider-hero-facts">{provider.city?<span><MapPin aria-hidden="true"/>{provider.city}</span>:null}<span><Truck aria-hidden="true"/>{provider.trucks.length} active {provider.trucks.length===1?'truck':'trucks'}</span><span><Star aria-hidden="true"/>{provider.review_count?`${provider.average_rating} · ${provider.review_count} verified shipment ${provider.review_count===1?'review':'reviews'}`:'New to Loadgistic'}</span></div></div>
      <div id="provider-contacts" className="provider-public-contacts" aria-label="Public transporter contacts">{provider.contact_phone?<a href={`tel:${provider.contact_phone}`}><Phone aria-hidden="true"/><span><small>Call</small><strong>{provider.contact_phone}</strong></span></a>:null}{provider.contact_whatsapp?<a href={`https://wa.me/${String(provider.contact_whatsapp).replace(/\D/g,'')}`}><MessageCircle aria-hidden="true"/><span><small>Message</small><strong>WhatsApp</strong></span></a>:null}{provider.contact_email?<a href={`mailto:${provider.contact_email}`}><Mail aria-hidden="true"/><span><small>Write</small><strong>Email</strong></span></a>:null}{provider.contact_website?<a href={provider.contact_website} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true"/><span><small>Visit</small><strong>Website</strong></span></a>:null}</div>
    </div></section>
    <div className="container provider-site-content">
      <ProviderFleetShowcase providerName={provider.name} trucks={provider.trucks}/>
      <div className="provider-site-overview-grid"><section className="provider-site-section provider-about-card"><span className="provider-section-kicker"><Building2 aria-hidden="true"/>About</span><h2>About this transporter</h2><p className="lede">{provider.about||`${provider.name} provides road-freight transport from ${provider.city||'Ethiopia'}.`}</p>{provider.services?<div className="provider-services"><small>Transport services</small><strong>{provider.services}</strong></div>:null}</section><section className="provider-site-section provider-trust-card"><span className="provider-section-kicker"><ShieldCheck aria-hidden="true"/>Credentials</span><h2>Reviewed documents</h2><VerificationBadges badges={provider.verification_badges}/><p>Select a badge for its review details. Confirm current originals and operating authority directly.</p></section></div>
      {provider.youtube_video_id?<section className="provider-site-section provider-video-section"><div><span className="provider-section-kicker"><Building2 aria-hidden="true"/>Transporter introduction</span><h2>Meet {provider.name}</h2></div><ProviderIntroVideo videoId={provider.youtube_video_id} providerName={provider.name}/></section>:null}
      <div className="provider-site-lower-grid">{corridors.size?<section className="provider-site-section"><span className="provider-section-kicker"><Route aria-hidden="true"/>Regular service</span><h2>Regular service</h2><div className="provider-corridor-list">{[...corridors.values()].slice(0,1).map(signal=><div key={signal.id}><strong>{signal.geometry==='RADIUS'?`${signal.area_center_label||'Area center'} · ${(signal.area_boundary||[]).map((point:any)=>point.label).join(' · ')}`:(signal.route_points||[]).map((point:any)=>point.label).join(' ↔ ')}</strong><span>Regular {signal.geometry==='RADIUS'?'Service area':'two-way Capacity route'} · confirm availability</span></div>)}</div></section>:null}<section className="provider-site-section"><span className="provider-section-kicker"><Star aria-hidden="true"/>Customer experience</span><h2>Verified shipment reviews</h2>{provider.reviews.length?<div className="provider-review-list">{provider.reviews.map((review:any,index:number)=><article key={`${review.created_at}-${index}`}><strong>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</strong>{review.note?<p>{review.note}</p>:null}<span>Verified completed shipment · {new Date(review.created_at).toLocaleDateString()}</span>{review.dispute_status==='PENDING'?<small>Provider dispute under review · rating remains published and counted</small>:null}</article>)}</div>:<p className="muted">No verified shipment reviews yet.</p>}</section></div>
      <section className="provider-microsite-safety"><ShieldCheck aria-hidden="true"/><div><strong>Confirm service details before booking</strong><p>Check current documents, operating authority, truck and driver details, cargo compatibility, price, timing, and responsibility with the transporter.</p></div><Link className="button" href="/"><Truck aria-hidden="true"/>View available trucks</Link></section>
    </div>
  </main></>;
}
