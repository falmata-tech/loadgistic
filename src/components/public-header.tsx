
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import {LanguagePicker} from './localization';
import { LayoutDashboard, Truck } from 'lucide-react';
import { Logo } from './logo';
import { getCurrentUser } from '@/lib/auth';
import {WorkspaceAreaSwitch} from './workspace-area-switch';
import { PublicMobileNav } from './public-mobile-nav';
import { PublicAssistedChat } from './public-assisted-chat';
import {ChatAlerts} from './chat-alerts';

export async function PublicHeader() {
  const user = await getCurrentUser();
  const provider=user&&['TRANSPORTER','DRIVER'].includes(user.role);
  return (
    <>
      <header className="public-header">
        <div className="container public-nav">
          <Logo />
          {user&&['TRANSPORTER','DRIVER','SUPPORT','ADMIN'].includes(user.role)?<ChatAlerts identity={user.id}/>:null}
          <div className="public-header-language"><LanguagePicker/></div>
          <div className="public-session-compact" data-testid="public-session-action">
            {provider?null:user
              ? <Localized as="link" copy={["aria-label","title"]} className="button public-dashboard-action" href="/app/home" aria-label="Dashboard" title="Dashboard"><LayoutDashboard aria-hidden="true"/><span><Text message="Dashboard"/></span></Localized>
              : <Localized as="link" copy={["aria-label","title"]} className="button secondary public-login-action" href="/login" aria-label="Transporter login" title="Transporter login"><Truck aria-hidden="true"/><span><Text message="Transporter login"/></span></Localized>}
          </div>
        </div>
      </header>
      {provider?<WorkspaceAreaSwitch area="marketplace" actorId={user.id}/>:null}
      <PublicMobileNav signedIn={Boolean(user)} providerWorkspace={Boolean(provider)} />
      <PublicAssistedChat />
    </>
  );
}
