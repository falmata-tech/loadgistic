import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { TransportExpoVenue } from '@/components/transport-expo-venue';

export function FeaturedProviderSection({feature}:{feature:any}){
  if(!feature)return null;
  const providerCount=feature.providers?.length||0;
  const headline=feature.headline?.replace(/^Today[’']s Daily Featured Transporters$/,'Daily Featured Transporters')||'Daily Featured Transporters';
  return <section id="featured-providers" className="featured-provider-section" aria-labelledby="featured-provider-title"><div className="container regional-expo-shell">
    <header className="regional-expo-intro"><div><span className="section-kicker">Featured transporter programme</span><h2 id="featured-provider-title">{headline}</h2><p>{feature.introduction}</p></div></header>
    {providerCount?<TransportExpoVenue providers={feature.providers} sponsoredProviders={feature.sponsored_providers||[]} featureDate={feature.feature_date} initialSchedule={feature.schedule} week={feature.week} expoGroup={feature.expo_group} tiktokUrl={feature.tiktok_url}/>:<div className="regional-expo-empty"><div><h3>Today&apos;s featured roster is being prepared.</h3><p>Explore current truck capacity now and return for today&apos;s transporter programme.</p></div><Link className="button secondary" href="/">View available trucks</Link></div>}
    <p className="featured-provider-note"><ShieldCheck aria-hidden="true"/>Featured eligibility and sponsorship do not guarantee service. Confirm current documents, capacity, cargo fit, pricing, and terms with the transporter.</p>
  </div></section>;
}
