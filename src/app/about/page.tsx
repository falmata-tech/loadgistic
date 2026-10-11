
import {Text} from '@/components/localization';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Boxes, Factory, Gauge, ShieldCheck, Truck } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import {platformAbout} from '@/lib/platform-copy.js';

export const metadata:Metadata={title:'About',description:'A shared view of transporter capacity and routes for brokers and shipping teams. Public discovery, private networks and tracking after transport is agreed.'};

const sectionIcons=[Factory,Truck,Gauge,Boxes,ShieldCheck];
export default function AboutPage(){return <><PublicHeader/><main className="public-app-page public-information-workspace"><header className="public-information-heading container"><span><Factory aria-hidden="true"/><Text message="About Loadgistic"/></span><h1><Text message={platformAbout.title}/></h1><p><Text message={platformAbout.body}/></p></header><div className="container public-information-grid about-information-grid">{platformAbout.sections.map(([title,body],index)=>{const Icon=sectionIcons[index]||Truck;return <section key={title}><Icon aria-hidden="true"/><h2><Text message={title}/></h2><p><Text message={body}/></p></section>;})}</div><aside className="container public-information-note about-information-actions"><ShieldCheck aria-hidden="true"/><span><strong><Text message="Choose your next step"/></strong><Text message="Explore signals open to the public, view those privately shared with you, or share your own truck availability."/></span><div><Link className="button" href="/"><Truck aria-hidden="true"/><Text message="Find capacity"/></Link><Link className="button secondary" href="/apply"><ArrowRight aria-hidden="true"/><Text message="Join as a transporter"/></Link></div></aside></main></>}
