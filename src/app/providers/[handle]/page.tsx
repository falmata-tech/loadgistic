import type {Metadata} from 'next';
import {publicPageMetadata} from '@/lib/seo.js';

import {Text,Localized} from '@/components/localization';
import {Pagination} from '@/components/pagination';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,Building2,ChevronDown,ExternalLink,Mail,Map,MapPin,MessageCircle,Phone,Star,Truck} from 'lucide-react';
import {PublicHeader} from '@/components/public-header';
import {ProviderIntroVideo} from '@/components/provider-intro-video';
import {ProviderFleetShowcase} from '@/components/provider-fleet-showcase';
import {VerificationBadges} from '@/components/verification-badges';
import {getPublicProvider} from '@/lib/public-provider.js';
import {ContentSafety} from '@/components/content-safety';
import {PublicIdentityImage} from '@/components/public-identity-image';

export const dynamic='force-dynamic';

export async function generateMetadata({params,searchParams}:{params:Promise<{handle:string}>;searchParams:Promise<Record<string,string|undefined>>}):Promise<Metadata>{
  const {handle}=await params,query=await searchParams;
  const normalized=handle.trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(normalized))return {robots:{index:false,follow:false}};
  // No second provider lookup and no private account identity enters metadata.
  return publicPageMetadata({path:`/@${normalized}`,title:`@${normalized} · Transport Provider`,description:`View @${normalized} on Loadgistic: public transporter information, reviewed documents and available vehicles.`,query});
}

export default async function ProviderPage({params,searchParams}:{params:Promise<{handle:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const {handle}=await params;
  const query=await searchParams;
  const provider:any=await getPublicProvider(handle,{truckPage:query.truckPage});
  if(!provider)notFound();
  const isCompany=provider.provider_kind==='FLEET_TRANSPORTER';
  const fleet=provider.fleet_page.total>0?<>
    <ProviderFleetShowcase key={provider.fleet_page.page} providerName={provider.name} trucks={provider.trucks} total={provider.fleet_page.total} startIndex={(provider.fleet_page.page-1)*provider.fleet_page.pageSize}/>
    {provider.fleet_page.pageCount>1?<Pagination path={`/@${provider.handle}`} query={{}} pageParam="truckPage" fragment="provider-trucks" page={provider.fleet_page.page} pageCount={provider.fleet_page.pageCount} total={provider.fleet_page.total}/>:null}
  </>:null;
  return <><PublicHeader/><ContentSafety handle={provider.handle}><main className="provider-microsite provider-microsite-v2">
    <div className="container provider-site-back"><Link href={`/?provider=${encodeURIComponent(provider.handle)}`}><ArrowLeft aria-hidden="true"/><Text message="Back to Open capacity"/></Link></div>
    <section className="provider-site-hero"><div className="container provider-site-hero-grid">
      <PublicIdentityImage className="provider-site-mark provider-profile-image" path={provider.profile_image_url} kind={isCompany?"company":"person"} label={isCompany?`${provider.name} transporter profile`:provider.name}/>
      <div className="provider-site-identity"><span className="provider-handle"><Text message="Transport Provider"/></span><h1>{provider.account_name||provider.name}</h1><p>@{provider.handle}</p>{provider.manager_name?<p><Text message="Account manager"/> · {provider.manager_name}</p>:null}{isCompany&&provider.headline?<p>{provider.headline}</p>:null}<div className="provider-hero-facts">{isCompany&&provider.city?<span><MapPin aria-hidden="true"/>{provider.city}</span>:null}<span><Truck aria-hidden="true"/>{provider.fleet_page.total===1?<Text message="{count} active vehicle" values={{count:1}}/>:<Text message="{count} active vehicles" values={{count:provider.fleet_page.total}}/>}</span><span><Star aria-hidden="true"/>{provider.review_count?<Text message="{rating} · {count} verified shipment reviews" values={{rating:provider.average_rating,count:provider.review_count}}/>:<Text message="New to Loadgistic"/>}</span></div></div>
      <Localized as="div" copy={["aria-label"]} id="provider-contacts" className="provider-public-contacts" aria-label="Public transporter contacts">{provider.contact_phone?<a href={`tel:${provider.contact_phone}`}><Phone aria-hidden="true"/><span><small><Text message="Call"/></small><strong>{provider.contact_phone}</strong></span></a>:null}{isCompany&&provider.contact_whatsapp?<a href={`https://wa.me/${String(provider.contact_whatsapp).replace(/\D/g,'')}`}><MessageCircle aria-hidden="true"/><span><small><Text message="Message"/></small><strong><Text message="WhatsApp"/></strong></span></a>:null}{isCompany&&provider.contact_email?<a href={`mailto:${provider.contact_email}`}><Mail aria-hidden="true"/><span><small><Text message="Write"/></small><strong><Text message="Email"/></strong></span></a>:null}{isCompany&&provider.contact_website?<a href={provider.contact_website} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true"/><span><small><Text message="Visit"/></small><strong><Text message="Website"/></strong></span></a>:null}</Localized>
    </div></section>
    <div className="container provider-site-content">
      <section className="provider-site-section provider-trust-card"><h2><Text message="Account documents"/></h2><VerificationBadges badges={provider.verification_badges} rows/></section>
      {provider.fleet_page.total>0?<div className="provider-fleet-map-action"><Link className="button secondary" href={`/?provider=${encodeURIComponent(provider.handle)}`}><Map aria-hidden="true"/><Text message="See vehicles on the map"/></Link></div>:null}
      {provider.fleet_page.total>1?<details id="provider-trucks" className="provider-fleet-disclosure" open>
        <summary className="provider-fleet-toggle"><Truck aria-hidden="true"/><span className="fleet-open-label"><Text message="View vehicles and drivers"/></span><span className="fleet-close-label"><Text message="Hide vehicles and drivers"/></span><small><Text message="{count} vehicles" values={{count:provider.fleet_page.total}}/></small><ChevronDown aria-hidden="true"/></summary>
        {fleet}
      </details>:fleet?<div id="provider-trucks">{fleet}</div>:<section className="provider-site-section"><h2><Text message="Vehicles and drivers"/></h2><p><Text message="No vehicles listed."/></p><Link className="button secondary" href="/"><Text message="Open capacity"/></Link></section>}
      <div className="provider-site-lower-grid provider-site-reviews"><section className="provider-site-section"><span className="provider-section-kicker"><Star aria-hidden="true"/><Text message="Customer experience"/></span><h2><Text message="Verified shipment reviews"/></h2>{provider.reviews.length?<div className="provider-review-list">{provider.reviews.map((review:any,index:number)=><article key={`${review.created_at}-${index}`}><strong>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</strong>{review.note?<p>{review.note}</p>:null}<span><Text message="Verified completed shipment · "/>{new Date(review.created_at).toLocaleDateString()}</span>{review.dispute_status==='PENDING'?<small><Text message="Provider dispute under review · rating remains published and counted"/></small>:null}<ContentSafety handle={provider.handle} reviewId={review.id}/></article>)}</div>:<p className="muted"><Text message="No verified shipment reviews yet."/></p>}</section></div>
      {isCompany&&provider.about?<section className="provider-site-section provider-about-card"><span className="provider-section-kicker"><Building2 aria-hidden="true"/><Text message="About"/></span><h2><Text message="About this transporter"/></h2><p className="lede">{provider.about}</p></section>:null}
      {isCompany&&provider.youtube_video_id?<section className="provider-site-section provider-video-section"><div><span className="provider-section-kicker"><Building2 aria-hidden="true"/><Text message="Transporter introduction"/></span><h2><Text message="Meet {name}" values={{name:provider.name}}/></h2></div><ProviderIntroVideo videoId={provider.youtube_video_id} providerName={provider.name}/></section>:null}

    </div>
  </main></ContentSafety></>;
}
