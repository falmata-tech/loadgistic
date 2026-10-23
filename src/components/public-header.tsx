
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import {LanguagePicker} from './localization';
import { LayoutDashboard, UserRound } from 'lucide-react';
import shellStyles from './workspace-shell.module.css';
import { Logo } from './logo';
import { getCurrentUser } from '@/lib/auth';
import {WorkspaceAreaSwitch} from './workspace-area-switch';
import { PublicMobileNav } from './public-mobile-nav';
import {ChatAlerts} from './chat-alerts';

export async function PublicHeader() {
  const user = await getCurrentUser();
  const provider=user&&['TRANSPORTER','DRIVER','CUSTOMER'].includes(user.role);
  return (
    <>
      <header className={`public-header ${shellStyles.publicHeader}`}>
        <div className="container public-nav">
          <Logo />
          {user&&['TRANSPORTER','DRIVER','CUSTOMER','SUPPORT','ADMIN'].includes(user.role)&& (user.role!=='SUPPORT'||user.can_manage_support)?<ChatAlerts identity={user.id} allowHandoverAlerts={user.active===true&&['DRIVER','TRANSPORTER'].includes(user.platform_role||user.role)}/>:null}
          <div className="public-header-language"><LanguagePicker/></div>
          <div className="public-session-compact" data-testid="public-session-action">
            {provider?null:user
              ? <Localized as="link" copy={["aria-label","title"]} className="button public-dashboard-action" href="/app/home" aria-label="Dashboard" title="Dashboard"><LayoutDashboard aria-hidden="true"/><span><Text message="Dashboard"/></span></Localized>
              : <Localized as="link" copy={["aria-label","title"]} className="button secondary public-login-action" href="/login" aria-label="Sign in" title="Sign in"><UserRound aria-hidden="true"/><span><Text message="Sign in"/></span></Localized>}
          </div>
        </div>
      </header>
      {!user||provider?<WorkspaceAreaSwitch area="marketplace" actorId={provider?user?.selected_business_workspace?`${user.id}:business:${user.selected_business_workspace.id}`:user?.id:undefined}/>:null}
      <PublicMobileNav signedIn={Boolean(user)} providerWorkspace={Boolean(provider)} />
    </>
  );
}
