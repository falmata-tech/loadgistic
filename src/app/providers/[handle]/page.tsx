
import {Text,Localized} from '@/components/localization';
import {Pagination} from '@/components/pagination';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,Building2,ChevronDown,ExternalLink,Mail,MapPin,MessageCircle,Phone,Route,ShieldCheck,Star,Truck} from 'lucide-react';
import {PublicHeader} from '@/components/public-header';
import {ProviderIntroVideo} from '@/components/provider-intro-video';
import {ProviderFleetShowcase} from '@/components/provider-fleet-showcase';
import {VerificationBadges} from '@/components/verification-badges';
import {getPublicProvider} from '@/lib/public-provider.js';

export const dynamic='force-dynamic';

export default async function ProviderPage({params,searchParams}:{params:Promise<{handle:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const {handle}=await params;
  const query=await searchParams;
  const provider:any=await getPublicProvider(handle,{truckPage:query.truckPage});
  if(!provider)notFound();
  const regularService=provider.regular_service;
  const fleet=provider.fleet_page.total>0?<>
    <ProviderFleetShowcase key={provider.fleet_page.page} providerName={provider.name} trucks={provider.trucks} total={provider.fleet_page.total} startIndex={(provider.fleet_page.page-1)*provider.fleet_page.pageSize}/>
    {provider.fleet_page.pageCount>1?<Pagination path={`/@${provider.handle}`} query={{}} pageParam="truckPage" fragment="provider-trucks" page={provider.fleet_page.page} pageCount={provider.fleet_page.pageCount} total={provider.fleet_page.total}/>:null}
  </>:null;
  return <><PublicHeader/><main className="provider-microsite provider-microsite-v2">
    <div className="container provider-site-back"><Link href={`/?q=${encodeURIComponent(provider.name)}`}><ArrowLeft aria-hidden="true"/><Text message="Back to Open capacity"/></Link></div>
    <section className="provider-site-hero"><div className="container provider-site-hero-grid">
      <img className="provider-site-mark provider-profile-image" src={provider.profile_image_url||'/marketing/default-transporter-profile.png'} alt={provider.profile_image_url?`${provider.name} transporter profile`:`Default transporter portrait for ${provider.name}`}/>
      <div className="provider-site-identity"><span className="provider-handle"><Text message={provider.provider_kind_label}/> · /@{provider.handle}</span><h1>{provider.name}</h1><p>{provider.headline||<Text message="Professional road-freight services across Ethiopia"/>}</p><div className="provider-hero-facts">{provider.city?<span><MapPin aria-hidden="true"/>{provider.city}</span>:null}<span><Truck aria-hidden="true"/>{provider.fleet_page.total===1?<Text message="{count} active truck" values={{count:1}}/>:<Text message="{count} active trucks" values={{count:provider.fleet_page.total}}/>}</span><span><Star aria-hidden="true"/>{provider.review_count?<Text message="{rating} · {count} verified shipment reviews" values={{rating:provider.average_rating,count:provider.review_count}}/>:<Text message="New to Loadgistic"/>}</span></div></div>
      <Localized as="div" copy={["aria-label"]} id="provider-contacts" className="provider-public-contacts" aria-label="Public transporter contacts">{provider.contact_phone?<a href={`tel:${provider.contact_phone}`}><Phone aria-hidden="true"/><span><small><Text message="Call"/></small><strong>{provider.contact_phone}</strong></span></a>:null}{provider.contact_whatsapp?<a href={`https://wa.me/${String(provider.contact_whatsapp).replace(/\D/g,'')}`}><MessageCircle aria-hidden="true"/><span><small><Text message="Message"/></small><strong><Text message="WhatsApp"/></strong></span></a>:null}{provider.contact_email?<a href={`mailto:${provider.contact_email}`}><Mail aria-hidden="true"/><span><small><Text message="Write"/></small><strong><Text message="Email"/></strong></span></a>:null}{provider.contact_website?<a href={provider.contact_website} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true"/><span><small><Text message="Visit"/></small><strong><Text message="Website"/></strong></span></a>:null}</Localized>
    </div></section>
    <div className="container provider-site-content">
      <div className="provider-site-overview-grid"><section className="provider-site-section provider-about-card"><span className="provider-section-kicker"><Building2 aria-hidden="true"/><Text message="About"/></span><h2><Text message="About this transporter"/></h2><p className="lede">{provider.about||<Text message="{name} provides road-freight transport from {city}." values={{name:provider.name,city:provider.city||'Ethiopia'}}/>}</p>{provider.services?<div className="provider-services"><small><Text message="Transport services"/></small><strong>{provider.services}</strong></div>:null}</section><section className="provider-site-section provider-trust-card"><span className="provider-section-kicker"><ShieldCheck aria-hidden="true"/><Text message="Credentials"/></span><h2><Text message="Reviewed documents"/></h2><VerificationBadges badges={provider.verification_badges}/><p><Text message="Select a badge for its review details. Confirm current originals and operating authority directly."/></p></section></div>
      {provider.youtube_video_id?<section className="provider-site-section provider-video-section"><div><span className="provider-section-kicker"><Building2 aria-hidden="true"/><Text message="Transporter introduction"/></span><h2><Text message="Meet {name}" values={{name:provider.name}}/></h2></div><ProviderIntroVideo videoId={provider.youtube_video_id} providerName={provider.name}/></section>:null}
      <div className="provider-site-lower-grid">{regularService?<section className="provider-site-section"><span className="provider-section-kicker"><Route aria-hidden="true"/><Text message="Regular service"/></span><h2><Text message="Regular service"/></h2><div className="provider-corridor-list"><div><strong>{regularService.geometry==='RADIUS'?[regularService.area_center_label,...regularService.area_labels].filter(Boolean).join(' · '):regularService.route_labels.join(' ↔ ')}</strong><span>{regularService.geometry==='RADIUS'?<Text message="Regular service area · confirm availability"/>:<Text message="Regular two-way Capacity route · confirm availability"/>}</span></div></div></section>:null}<section className="provider-site-section"><span className="provider-section-kicker"><Star aria-hidden="true"/><Text message="Customer experience"/></span><h2><Text message="Verified shipment reviews"/></h2>{provider.reviews.length?<div className="provider-review-list">{provider.reviews.map((review:any,index:number)=><article key={`${review.created_at}-${index}`}><strong>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</strong>{review.note?<p>{review.note}</p>:null}<span><Text message="Verified completed shipment · "/>{new Date(review.created_at).toLocaleDateString()}</span>{review.dispute_status==='PENDING'?<small><Text message="Provider dispute under review · rating remains published and counted"/></small>:null}</article>)}</div>:<p className="muted"><Text message="No verified shipment reviews yet."/></p>}</section></div>
      {provider.fleet_page.total>1?<details id="provider-trucks" className="provider-fleet-disclosure" open={Boolean(query.truckPage)}>
        <summary className="provider-fleet-toggle"><Truck aria-hidden="true"/><span className="fleet-open-label"><Text message="View trucks and drivers"/></span><span className="fleet-close-label"><Text message="Hide trucks and drivers"/></span><small><Text message="{count} trucks" values={{count:provider.fleet_page.total}}/></small><ChevronDown aria-hidden="true"/></summary>
        {fleet}
      </details>:fleet?<div id="provider-trucks">{fleet}</div>:null}
      <section className="provider-microsite-safety"><ShieldCheck aria-hidden="true"/><div><strong><Text message="Confirm service details before booking"/></strong><p><Text message="Check current documents, operating authority, truck and driver details, cargo compatibility, price, timing, and responsibility with the transporter."/></p></div><Link className="button" href="/"><Truck aria-hidden="true"/><Text message="View available trucks"/></Link></section>
    </div>
  </main></>;
}
