import Link from 'next/link';
import type {Metadata} from 'next';
import {Text} from '@/components/localization';
import {PublicHeader} from '@/components/public-header';
import {privacyContact,privacySections} from '@/lib/privacy-copy.js';
import {BlockedProviders} from '@/components/content-safety';
export const metadata:Metadata={title:'Privacy',description:'How Loadgistic uses account, location, shipment and file data, and how to request account deletion.'};
export default function PrivacyPage(){return <><PublicHeader/><main className="public-app-page public-information-workspace"><header className="public-information-heading container"><h1><Text message="Privacy"/></h1><p><Text message="Loadgistic privacy information"/></p><p><Text message="Updated October 9, 2026"/></p></header><div className="container public-information-grid">{privacySections.map(([title,body])=><section key={title}><h2><Text message={title}/></h2><p><Text message={body}/></p></section>)}<section><BlockedProviders/></section></div><aside className="container public-information-note"><div><strong><Text message="Privacy contact"/></strong><p><a href={`mailto:${privacyContact}`}>{privacyContact}</a></p><Link href="/delete-account" className="button secondary"><Text message="Delete account and data"/></Link></div></aside></main></>}
