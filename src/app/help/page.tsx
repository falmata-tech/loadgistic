import {Headphones,MessageCircle,ShieldCheck} from 'lucide-react';
import {PublicHeader} from '@/components/public-header';
import {Flash} from '@/components/flash';
import {getAssistedMatchingAvailability} from '@/lib/repository.js';

export default async function HelpPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const query=await searchParams;
  const presence=await getAssistedMatchingAvailability();
  return <><PublicHeader/><main className="public-app-page public-information-workspace"><header className="public-information-heading container"><span><Headphones aria-hidden="true"/>Chat recovery</span><h1>Return to a previous chat.</h1><p>The floating Ask Loadgistic button is the normal place to start and continue a chat. Use this page only when returning on another browser.</p><div className={`assisted-presence ${presence.available?'online':'offline'}`}><span aria-hidden="true"/>{presence.available?`${presence.availableTeamMembers} team member${presence.availableTeamMembers===1?'':'s'} available now`:'Team currently away · leave a message'}</div></header><Flash error={query.error} success={query.success}/><section className="container guest-support-start"><aside className="card guest-support-recover"><h2>Open a saved chat</h2><p>Use the email and recovery code sent when the chat started.</p><form action="/api/guest-support/access" method="post"><label>Email<input name="email" type="email" required/></label><label>Recovery code<input name="code" required/></label><button className="button secondary">Open chat</button></form></aside><div className="card"><MessageCircle aria-hidden="true"/><h2>Start on any public page</h2><p>Return to the Truck Market and select <strong>Ask Loadgistic</strong>. Your active chat will stay available as you browse.</p><a className="button" href="/">Open Truck Market</a><p className="meta"><ShieldCheck aria-hidden="true"/>Do not send passwords, PINs, or one-time codes.</p></div></section></main></>;
}
