import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { TransportExpoVenue } from '@/components/transport-expo-venue';

export function FeaturedProviderSection({feature}:{feature:any}){
  if(!feature)return null;
  const providerCount=feature.providers?.length||0;
  const headline=feature.headline||'Daily Featured Trucks';
  return <section id="featured-providers" className="featured-provider-section" aria-labelledby="featured-provider-title"><div className="container regional-expo-shell">
    <header className="regional-expo-intro"><div><span className="section-kicker">Featured</span><h2 id="featured-provider-title">{headline}</h2><p>{feature.introduction}</p></div></header>
    {providerCount?<TransportExpoVenue providers={feature.providers} sponsoredProviders={feature.sponsored_providers||[]} featureDate={feature.feature_date} initialSchedule={feature.schedule} week={feature.week} expoGroup={feature.expo_group} tiktokUrl={feature.tiktok_url}/>:<div className="regional-expo-empty"><div><h3>Today&apos;s truck roster is being prepared.</h3><p>Find current capacity while the morning programme is being arranged.</p></div><Link className="button secondary" href="/">Find capacity</Link></div>}
    <p className="featured-provider-note"><ShieldCheck aria-hidden="true"/>Confirm current documents, capacity, cargo fit, price, and timing directly.</p>
  </div></section>;
}
