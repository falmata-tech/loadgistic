import {publicPageMetadata} from '@/lib/seo.js';

import type {Metadata} from 'next';
import {PublicHeader} from '@/components/public-header';
import {AboutAudiences} from '@/components/about-audiences';

export const metadata:Metadata=publicPageMetadata({path:'/about',title:'Transport capacity, fleet management and tracking',description:'Transport Providers can share available vehicle space, manage a fleet and connect compatible GPS trackers. Shippers and brokers can build a transport network and follow agreed shipments.'});

export default function AboutPage(){return <><PublicHeader/><main className="public-app-page public-information-workspace"><AboutAudiences/></main></>;}
