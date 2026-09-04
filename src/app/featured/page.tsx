import type {Metadata} from 'next';
import {FeaturedProviderSection} from '@/components/featured-provider-section';
import {PublicHeader} from '@/components/public-header';
import {getDailyFeaturedProviders} from '@/lib/public-featured.js';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Daily Featured Trucks',description:'Meet today\'s featured trucks, Drivers, and transport providers.'};

export default async function FeaturedTransportersPage(){
  const featured=await getDailyFeaturedProviders();
  return <><PublicHeader/><main className="public-app-page featured-workspace-page"><h1 className="sr-only">Daily Featured Trucks</h1><FeaturedProviderSection feature={featured}/></main></>;
}
