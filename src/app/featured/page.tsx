import {publicPageMetadata} from '@/lib/seo.js';

import {Text} from '@/components/localization';
import type {Metadata} from 'next';
import {FeaturedProviderSection} from '@/components/featured-provider-section';
import {PublicHeader} from '@/components/public-header';
import {getDailyFeaturedProviders} from '@/lib/public-featured.js';
import {FeaturedRetry} from '@/components/featured-retry';
import Link from 'next/link';

export const dynamic='force-dynamic';
export const metadata:Metadata=publicPageMetadata({path:'/featured',title:'Featured Vehicles',description:'Meet featured vehicles, drivers and Transport Providers on Loadgistic.'});

export default async function FeaturedTransportersPage(){
  let featured;
  try{featured=await getDailyFeaturedProviders();}
  catch(error){
    const category=error instanceof Error?error.message:'';
    if(!/^SUPABASE_(?:PUBLIC_FEATURED|PUBLIC_SPONSORS|FEATURED_(?:TRUCKS|CAPACITY|DRIVERS))_FAILED$/.test(category)
      &&category!=='SUPABASE_PUBLIC_FEATURED_SLOTS_FAILED')throw error;
    console.error(category);
    return <><PublicHeader/><main className="public-app-page featured-workspace-page"><section className="container regional-expo-shell"><h1><Text message="Daily Featured Vehicles"/></h1><p role="alert"><Text message="Featured is unavailable right now. Please try again."/></p><div className="actions"><FeaturedRetry/><Link className="button secondary" href="/"><Text message="Find capacity"/></Link></div></section></main></>;
  }
  return <><PublicHeader/><main className="public-app-page featured-workspace-page"><h1 className="sr-only"><Text message="Daily Featured Vehicles"/></h1><FeaturedProviderSection feature={featured}/></main></>;
}
