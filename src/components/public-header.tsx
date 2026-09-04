import Link from 'next/link';
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
          <span className="public-app-context">Capacity sharing &amp; tracking</span>
          <div className="public-session-compact" data-testid="public-session-action">
            {user
              ? <Link className="button public-dashboard-action" href="/app/home" aria-label="Dashboard" title="Dashboard"><LayoutDashboard aria-hidden="true"/><span>Dashboard</span></Link>
              : <Link className="button secondary public-login-action" href="/login" aria-label="Log in" title="Log in"><LogIn aria-hidden="true"/><span>Log in</span></Link>}
          </div>
        </div>
      </header>
      <PublicMobileNav signedIn={Boolean(user)} />
      <PublicAssistedChat />
    </>
  );
}
