
import {Text} from '@/components/localization';
import {Headphones,MessageCircle,ShieldCheck} from 'lucide-react';
import {PublicHeader} from '@/components/public-header';
import {Flash} from '@/components/flash';
import {getAssistedMatchingAvailability} from '@/lib/support.js';

export default async function HelpPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const query=await searchParams;
  const presence=await getAssistedMatchingAvailability();
  return <><PublicHeader/><main className="public-app-page public-information-workspace"><header className="public-information-heading container"><span><Headphones aria-hidden="true"/><Text message="Chat recovery"/></span><h1><Text message="Return to a previous chat."/></h1><p><Text message="The floating Ask Loadgistic button is the normal place to start and continue a chat. Use this page only when returning on another browser."/></p><div className={`assisted-presence ${presence.available?'online':'offline'}`}><span aria-hidden="true"/>{presence.available?`${presence.availableTeamMembers} team member${presence.availableTeamMembers===1?'':'s'} available now`:<Text message="Team currently away · leave a message"/>}</div></header><Flash error={query.error} success={query.success}/><section className="container guest-support-start"><aside className="card guest-support-recover"><h2><Text message="Open a saved chat"/></h2><p><Text message="Use the email and recovery code sent when the chat started."/></p><form action="/api/guest-support/access" method="post"><label><Text message="Email"/><input name="email" type="email" required/></label><label><Text message="Recovery code"/><input name="code" required/></label><button className="button secondary"><Text message="Open chat"/></button></form></aside><div className="card"><MessageCircle aria-hidden="true"/><h2><Text message="Start on any public page"/></h2><p><Text message="Return to Open capacity and select "/><strong><Text message="Ask Loadgistic"/></strong><Text message=". Your active chat will stay available as you browse."/></p><a className="button" href="/"><Text message="Open capacity"/></a><p className="meta"><ShieldCheck aria-hidden="true"/><Text message="Do not send passwords, PINs, or one-time codes."/></p></div></section></main></>;
}
