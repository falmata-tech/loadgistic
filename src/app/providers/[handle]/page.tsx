import type {Metadata} from 'next';
import {publicPageMetadata} from '@/lib/seo.js';

import {Text,Localized} from '@/components/localization';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,ExternalLink,Mail,MapPin,MessageCircle,Phone,Star,Truck} from 'lucide-react';
import {PublicHeader} from '@/components/public-header';
import {ProviderIntroVideo} from '@/components/provider-intro-video';
import {PublicCapacityFeed} from '@/components/public-capacity-feed';
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

export default async function ProviderPage({params}:{params:Promise<{handle:string}>}){
  const {handle}=await params;
  const provider:any=await getPublicProvider(handle,{includeVehicleDetails:false});
  if(!provider)notFound();
  const isCompany=provider.provider_kind==='FLEET_TRANSPORTER';
  const videoId=provider.cover_video_id===undefined&&isCompany?provider.youtube_video_id:provider.cover_video_id;
  return <><PublicHeader/><ContentSafety handle={provider.handle}><main className="provider-microsite provider-microsite-v2 provider-map-profile">
    <div className="container provider-site-back"><Link href={`/?provider=${encodeURIComponent(provider.handle)}`}><ArrowLeft aria-hidden="true"/><Text message="Back to Open capacity"/></Link></div>
    <section className="provider-site-hero"><div className="container provider-site-hero-grid">
      <PublicIdentityImage className="provider-site-mark provider-profile-image" path={provider.profile_image_url} kind={isCompany?"company":"person"} label={isCompany?`${provider.name} transporter profile`:provider.name}/>
      <div className="provider-site-identity"><span className="provider-handle"><Text message="Transport Provider"/></span><h1>{provider.account_name||provider.name}</h1><p>@{provider.handle}</p>{provider.manager_name?<p><Text message="Account manager"/> · {provider.manager_name}</p>:null}{isCompany&&provider.headline?<p>{provider.headline}</p>:null}<div className="provider-hero-facts">{isCompany&&provider.city?<span><MapPin aria-hidden="true"/>{provider.city}</span>:null}<span><Truck aria-hidden="true"/>{provider.fleet_page.total===1?<Text message="{count} active vehicle" values={{count:1}}/>:<Text message="{count} active vehicles" values={{count:provider.fleet_page.total}}/>}</span><span><Star aria-hidden="true"/>{provider.review_count?<Text message="{rating} · {count} verified shipment reviews" values={{rating:provider.average_rating,count:provider.review_count}}/>:<Text message="New to Loadgistic"/>}</span></div></div>
      <Localized as="div" copy={["aria-label"]} id="provider-contacts" className="provider-public-contacts" aria-label="Public transporter contacts">{provider.contact_phone?<a href={`tel:${provider.contact_phone}`}><Phone aria-hidden="true"/><span><small><Text message="Call"/></small><strong>{provider.contact_phone}</strong></span></a>:null}{isCompany&&provider.contact_whatsapp?<a href={`https://wa.me/${String(provider.contact_whatsapp).replace(/\D/g,'')}`}><MessageCircle aria-hidden="true"/><span><small><Text message="Message"/></small><strong><Text message="WhatsApp"/></strong></span></a>:null}{isCompany&&provider.contact_email?<a href={`mailto:${provider.contact_email}`}><Mail aria-hidden="true"/><span><small><Text message="Write"/></small><strong><Text message="Email"/></strong></span></a>:null}{isCompany&&provider.contact_website?<a href={provider.contact_website} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true"/><span><small><Text message="Visit"/></small><strong><Text message="Website"/></strong></span></a>:null}</Localized>
      {videoId?<ProviderIntroVideo key={videoId} videoId={videoId} providerName={provider.name}/>:null}
    </div></section>
    <div className="container provider-site-content">
      <div className="profile-map-information">
        <details className="provider-profile-documents"><summary><Text message="Account documents"/></summary><VerificationBadges badges={provider.verification_badges} rows/></details>
        <details className="provider-profile-information"><summary><Text message="About this transporter"/></summary>
          {isCompany&&provider.about?<p>{provider.about}</p>:null}
          <h2><Text message="Verified shipment reviews"/></h2>
          {provider.reviews.length?provider.reviews.map((review:any)=><article key={review.id} className="provider-profile-review"><strong>{review.rating} / 5</strong><p>{review.note}</p><small>{new Date(review.created_at).toLocaleDateString()}</small>{review.dispute_status==='PENDING'?<p><Text message="Provider dispute under review · rating remains published and counted"/></p>:null}<ContentSafety handle={provider.handle} reviewId={review.id}/></article>):<p><Text message="No verified shipment reviews yet."/></p>}
        </details>
      </div>
      <PublicCapacityFeed key={provider.handle} profileMap query={{provider:provider.handle}} initial={{items:[],hasMore:false,nextCursor:null,pageSize:14}}/>
    </div>
  </main></ContentSafety></>;
}
