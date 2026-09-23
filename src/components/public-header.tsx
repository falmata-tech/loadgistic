
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import {LanguagePicker} from './localization';
import { LayoutDashboard, LogIn } from 'lucide-react';
import { Logo } from './logo';
import { getCurrentUser } from '@/lib/auth';
import { PublicMobileNav } from './public-mobile-nav';
import { PublicAssistedChat } from './public-assisted-chat';

export async function PublicHeader() {
  const user = await getCurrentUser();
  return (
    <>
      <header className="public-header">
        <div className="container public-nav">
          <Logo />
          <span className="public-app-context"><Text message="Capacity sharing · Shipment tracking"/></span>
          <div className="public-header-language"><LanguagePicker/></div>
          <div className="public-session-compact" data-testid="public-session-action">
            {user
              ? <Localized as="link" copy={["aria-label","title"]} className="button public-dashboard-action" href="/app/home" aria-label="Dashboard" title="Dashboard"><LayoutDashboard aria-hidden="true"/><span><Text message="Dashboard"/></span></Localized>
              : <Localized as="link" copy={["aria-label","title"]} className="button secondary public-login-action" href="/login" aria-label="Log in" title="Log in"><LogIn aria-hidden="true"/><span><Text message="Log in"/></span></Localized>}
          </div>
        </div>
      </header>
      <PublicMobileNav signedIn={Boolean(user)} />
      <PublicAssistedChat />
    </>
  );
}
