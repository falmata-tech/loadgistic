import {publicPageMetadata} from '@/lib/seo.js';

import type {Metadata} from 'next';
import {PublicHeader} from '@/components/public-header';
import {AboutAudiences} from '@/components/about-audiences';

export const metadata:Metadata=publicPageMetadata({path:'/about',title:'About Loadgistic',description:'Keep the transporters you work with in one view. Find available vehicle space, share routes with customers and manage your fleet with Loadgistic.'});

export default function AboutPage(){return <><PublicHeader/><main className="public-app-page public-information-workspace"><AboutAudiences/></main></>;}
