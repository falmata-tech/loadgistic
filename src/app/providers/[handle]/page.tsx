import type {Metadata} from 'next';
import {publicPageMetadata} from '@/lib/seo.js';

import {Text,Localized} from '@/components/localization';
import {notFound} from 'next/navigation';
import {ArrowLeft,ExternalLink,FileCheck2,Mail,MapPin,MessageCircle,Phone,Truck} from 'lucide-react';
import {PublicHeader} from '@/components/public-header';
import {ProviderIntroVideo} from '@/components/provider-intro-video';
import {PublicCapacityFeed} from '@/components/public-capacity-feed';
import {VerificationBadges} from '@/components/verification-badges';
import {getPublicProvider} from '@/lib/public-provider.js';
import {getCurrentUser} from '@/lib/auth';
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
  const [provider,viewer]=await Promise.all([
    getPublicProvider(handle,{includeVehicleDetails:false}),
    getCurrentUser(),
  ]);
  if(!provider)notFound();
  const marketHref=['DRIVER','TRANSPORTER'].includes(viewer?.role||'')?'/app/home/market':'/';
  const isCompany=provider.provider_kind==='FLEET_TRANSPORTER';
  const videoId=provider.cover_video_id===undefined&&isCompany?provider.youtube_video_id:provider.cover_video_id;
  // The provider policy belongs to this document. Leaving the profile loads the destination's policy.
  return <><PublicHeader user={viewer} documentNavigation/><ContentSafety handle={provider.handle}><main className="provider-microsite provider-microsite-v2 provider-map-profile">
    <div className="container provider-site-back"><a href={marketHref}><ArrowLeft aria-hidden="true"/><Text message="Back to Open Market"/></a></div>
    <section className="container provider-site-hero">
      <div className="provider-site-hero-grid">
        <div className="provider-profile-main">
          <div className="provider-profile-heading">
            <PublicIdentityImage className="provider-site-mark provider-profile-image" path={provider.profile_image_url} kind={isCompany?"company":"person"} label={isCompany?`${provider.name} transporter profile`:provider.name}/>
            <div className="provider-site-identity">
              <span className="provider-handle"><Text message="Transport Provider"/></span>
              <h1>{provider.account_name||provider.name}</h1>
              <p>@{provider.handle}</p>
            </div>
          </div>
          {isCompany&&provider.headline?<p className="provider-profile-headline">{provider.headline}</p>:null}
          <div className="provider-profile-facts">
            {provider.account_is_demo===true?<span><Text message="Example account"/></span>:null}
            {isCompany&&provider.city?<span><MapPin aria-hidden="true"/>{provider.city}</span>:null}
            <span><Truck aria-hidden="true"/>{provider.fleet_page.total===1?<Text message="{count} active vehicle" values={{count:1}}/>:<Text message="{count} active vehicles" values={{count:provider.fleet_page.total}}/>}</span>
            {provider.manager_name?<span><Text message="Account manager"/> · {provider.manager_name}</span>:null}
          </div>
          <Localized as="div" copy={["aria-label"]} id="provider-contacts" className="provider-public-contacts" aria-label="Public transporter contacts">
            {provider.contact_phone?<a href={`tel:${provider.contact_phone}`}><Phone aria-hidden="true"/><span><small><Text message="Call"/></small><strong>{provider.contact_phone}</strong></span></a>:null}
            {isCompany&&provider.contact_whatsapp?<a href={`https://wa.me/${String(provider.contact_whatsapp).replace(/\D/g,'')}`}><MessageCircle aria-hidden="true"/><span><small><Text message="Message"/></small><strong><Text message="WhatsApp"/></strong></span></a>:null}
            {isCompany&&provider.contact_email?<a href={`mailto:${provider.contact_email}`}><Mail aria-hidden="true"/><span><small><Text message="Write"/></small><strong><Text message="Email"/></strong></span></a>:null}
            {isCompany&&provider.contact_website?<a href={provider.contact_website} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true"/><span><small><Text message="Visit"/></small><strong><Text message="Website"/></strong></span></a>:null}
          </Localized>
        </div>
        {videoId?<ProviderIntroVideo key={videoId} videoId={videoId}/>:null}
        <section className="provider-profile-documents">
          <h2><FileCheck2 aria-hidden="true"/><Text message="Account documents"/></h2>
          {provider.verification_badges?.length?<VerificationBadges badges={provider.verification_badges} rows/>:<p><Text message="No reviewed account documents yet."/></p>}
        </section>
      </div>
    </section>
    <div className="container provider-site-content">
      <div className="profile-map-information">
        {isCompany&&provider.about?<section className="provider-profile-about">
          <h2><Text message="About this transporter"/></h2><p>{provider.about}</p>
        </section>:null}
        <section className="provider-profile-reviews">
          <h2><Text message="Verified shipment reviews"/></h2>
          {provider.review_count?<p className="provider-profile-rating"><Text message="{rating} / 5 · {count} reviews" values={{rating:provider.average_rating??'—',count:provider.review_count}}/></p>:null}
          {provider.reviews.length?provider.reviews.map((review:any)=><article key={review.id} className="provider-profile-review">
            <strong>{review.rating} / 5</strong><p>{review.note}</p><small>{new Date(review.created_at).toLocaleDateString()}</small>
            {review.dispute_status==='PENDING'?<p><Text message="Provider dispute under review · rating remains published and counted"/></p>:null}<ContentSafety handle={provider.handle} reviewId={review.id}/>
          </article>):<p><Text message="No verified shipment reviews yet."/></p>}
        </section>
      </div>
      <PublicCapacityFeed key={provider.handle} profileMap query={{provider:provider.handle}} initial={{items:[],hasMore:false,nextCursor:null,pageSize:14}}/>
    </div>
  </main></ContentSafety></>;
}
