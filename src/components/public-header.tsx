import Link from 'next/link';
import { Building2, CirclePlus, LayoutDashboard, ListChecks, LogIn, Route } from 'lucide-react';
import { Logo } from './logo';
import { getCurrentUser } from '@/lib/auth';

export async function PublicHeader() {
  const user = await getCurrentUser();
  return (
    <header className="public-header">
      <div className="container public-nav">
        <Logo />
        <nav className="public-links" aria-label="Public navigation">
          <Link href="/#businesses"><Building2 aria-hidden="true"/>Businesses</Link>
          <Link href="/#transporters"><Route aria-hidden="true"/>Transporters</Link>
          <Link href="/#product"><ListChecks aria-hidden="true"/>Platform</Link>
          {user
            ? <Link className="button" href="/app/home"><LayoutDashboard aria-hidden="true"/>Workspace</Link>
            : <><Link className="button" href="/apply"><CirclePlus aria-hidden="true"/>Sign up</Link><Link className="button" href="/login"><LogIn aria-hidden="true"/>Log in</Link></>}
        </nav>
        <div className="public-session-compact" data-testid="public-session-action">
          {user
            ? <Link className="button" href="/app/home"><LayoutDashboard aria-hidden="true"/>Workspace</Link>
            : <><Link className="button" href="/apply"><CirclePlus aria-hidden="true"/>Sign up</Link><Link className="button" href="/login"><LogIn aria-hidden="true"/>Log in</Link></>}
        </div>
      </div>
    </header>
  );
}
