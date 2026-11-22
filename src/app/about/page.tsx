import {AppInstallLink} from '@/components/app-install';
import {publicPageMetadata} from '@/lib/seo.js';

import type {Metadata} from 'next';
import {PublicHeader} from '@/components/public-header';
import {AboutAudiences} from '@/components/about-audiences';

export const metadata:Metadata=publicPageMetadata({path:'/about',title:'How Loadgistic works for brokers, shippers and transporters',description:'Transporters manage their vehicles and drivers. Brokers and shippers see the capacity transporters share and follow shipments once the work is agreed.'});

export default function AboutPage(){return <><PublicHeader/><main className="public-app-page public-information-workspace"><AboutAudiences/><div className="container about-install"><AppInstallLink className="button secondary"/></div></main></>;}
