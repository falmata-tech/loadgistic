'use client';
import Link from 'next/link';
import {UserRound} from 'lucide-react';
import {Localized,Text} from './localization';
import {LanguagePicker} from './localization';
import {Logo} from './logo';
import {ChatAlerts} from './chat-alerts';
import {StaffAccount} from './staff-account';
import {accountHref,type SiteNavigationUser} from './site-navigation';

export function SiteTopbar({user}:{user:SiteNavigationUser|null}){
 return <header className="public-header unified-site-header"><div className="container public-nav">
  <Logo href={['DRIVER','TRANSPORTER'].includes(user?.role||'')?'/app/home':'/'}/>
  {user&&(!['SUPPORT','ADMIN'].includes(user.role)||user.canManageSupport)?<ChatAlerts identity={user.id} allowHandoverAlerts={user.active===true&&['DRIVER','TRANSPORTER'].includes(user.role)}/>:null}
  <div className="public-header-language"><LanguagePicker/></div>
  <div className="public-session-compact" data-testid="public-session-action">
   {user?<StaffAccount name={user.accountName||user.name} href={accountHref(user)} ariaLabel="Account"/>
    :<Localized as="link" copy={["aria-label","title"]} className="button secondary public-login-action" href="/login" aria-label="Sign in" title="Sign in"><UserRound aria-hidden="true"/><span><Text message="Sign in"/></span></Localized>}
  </div>
 </div></header>;
}
