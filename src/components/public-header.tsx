import Link from 'next/link';
import { Building2, CirclePlus, Gauge, Info, LayoutDashboard, LogIn, Route } from 'lucide-react';
import { Logo } from './logo';
import { getCurrentUser } from '@/lib/auth';

export async function PublicHeader() {
  const user = await getCurrentUser();
  return (
    <header className="public-header">
      <div className="container public-nav">
        <Logo />
        <nav className="public-links" aria-label="Public navigation">
          <Link href="/capacity"><Gauge aria-hidden="true"/>Capacity</Link>
          <Link href="/providers"><Building2 aria-hidden="true"/>Providers</Link>
          <Link href="/track"><Route aria-hidden="true"/>Track</Link>
          <Link href="/about"><Info aria-hidden="true"/>About</Link>
          {user
            ? <Link className="button" href="/app/home"><LayoutDashboard aria-hidden="true"/>Workspace</Link>
            : <><Link className="button" href="/apply"><CirclePlus aria-hidden="true"/>Provider sign up</Link><Link className="button" href="/login"><LogIn aria-hidden="true"/>Provider login</Link></>}
        </nav>
        <div className="public-session-compact" data-testid="public-session-action">
          {user
            ? <Link className="button" href="/app/home"><LayoutDashboard aria-hidden="true"/>Workspace</Link>
            : <><Link className="button" href="/apply"><CirclePlus aria-hidden="true"/>Provider sign up</Link><Link className="button" href="/login"><LogIn aria-hidden="true"/>Provider login</Link></>}
        </div>
      </div>
    </header>
  );
}
