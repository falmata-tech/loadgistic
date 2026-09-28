import {Text} from '@/components/localization';
import Link from 'next/link';
import {PublicHeader} from '@/components/public-header';
import {Flash} from '@/components/flash';
export default async function HelpPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const query=await searchParams;
 return <><PublicHeader/><main className="public-app-page public-information-workspace"><header className="public-information-heading container"><h1><Text message="Support"/></h1><p><Text message="Transport providers can contact live support from their dashboard."/></p><Link className="button" href="/app/support"><Text message="Open dashboard support"/></Link></header><Flash error={query.error} success={query.success}/><section className="container guest-support-start"><details className="card guest-support-recover"><summary><Text message="View a previous conversation"/></summary><p><Text message="Use the email and recovery code sent when the chat started."/></p><p><Text message="This conversation is read-only."/></p><form action="/api/guest-support/access" method="post"><label><Text message="Email"/><input name="email" type="email" required/></label><label><Text message="Recovery code"/><input name="code" required/></label><button className="button secondary"><Text message="View conversation"/></button></form></details></section></main></>;
}
