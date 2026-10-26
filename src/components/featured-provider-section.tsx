'use client';
import React from 'react';
import {useBlockedProviders} from './content-safety';
import {Text} from '@/components/localization';
import Link from 'next/link';
import { TransportExpoVenue } from '@/components/transport-expo-venue';
import {FEATURED_PUBLIC_HEADING,curatedFeaturedHeadline,curatedFeaturedIntroduction} from '@/lib/featured-heading-presentation.js';
import {featuredRange,featuredRangeLabel} from '@/lib/featured-time-presentation.js';

export function FeaturedProviderSection({feature}:{feature:any}){
  const {blocked}=useBlockedProviders(),blockKey=JSON.stringify(blocked);
  const providers=React.useMemo(()=>(feature?.providers||[]).filter((item:any)=>!blocked.includes(item.handle)),[feature,blockKey]);
  const sponsors=React.useMemo(()=>(feature?.sponsored_providers||[]).filter((item:any)=>!blocked.includes(item.handle)),[feature,blockKey]);
  if(!feature)return null;
  const providerCount=providers.length;
  const curatedHeadline=curatedFeaturedHeadline(feature.headline);
  const curatedIntroduction=curatedFeaturedIntroduction(feature.introduction);
  const featureDate=String(feature.feature_date||'');
  const dateLabel=/^\d{4}-\d{2}-\d{2}$/.test(featureDate)?new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(`${featureDate}T12:00:00Z`)):'';
  const windowLabel=featuredRangeLabel(feature.schedule?.display_label)||featuredRange(feature.broadcast_start_time,feature.broadcast_end_time);
  return <section id="featured-providers" className="featured-provider-section" aria-labelledby="featured-provider-title"><div className="container regional-expo-shell">
    <header className="regional-expo-intro"><div><h2 id="featured-provider-title"><Text message={FEATURED_PUBLIC_HEADING}/></h2>{!providerCount&&dateLabel&&windowLabel?<small>{dateLabel} · {windowLabel}</small>:null}{curatedHeadline?<p className="featured-curated-title"><strong><Text message={curatedHeadline}/></strong></p>:null}{curatedIntroduction?<p><Text message={curatedIntroduction}/></p>:null}</div></header>
    {providerCount?<TransportExpoVenue providers={providers} sponsoredProviders={sponsors} featureDate={feature.feature_date} initialSchedule={feature.schedule} week={feature.week} expoGroup={feature.expo_group} tiktokUrl={feature.tiktok_url} tiktokStatus={feature.tiktok_broadcast_status} tiktokStart={feature.broadcast_start_time}/>:<div className="regional-expo-empty"><div><h3><Text message="No Transport Providers are scheduled today."/></h3><p><Text message="You can still explore vehicles with published capacity."/></p></div><Link className="button secondary" href="/"><Text message="Find capacity"/></Link></div>}
  </div></section>;
}
