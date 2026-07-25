import Link from 'next/link';
import { Logo } from './logo';
import { getCurrentUser } from '@/lib/auth';

export async function PublicHeader() {
  const user = await getCurrentUser();
  return (
    <header className="public-header">
      <div className="container public-nav">
        <Logo />
        <nav className="public-links" aria-label="Public navigation">
          <Link href="/#solutions">Solutions</Link>
          <Link href="/companies">Company Pages</Link>
          <Link href="/#how">How It Works</Link>
          <Link href="/#plans">Plans</Link>
          <Link href="/apply">Apply</Link>
          {user ? <Link className="button" href="/app/home">Workspace</Link> : <><Link href="/login">Login</Link><Link className="button" href="/login">Get Started</Link></>}
        </nav>
        <Link className="button public-session-compact" data-testid="public-session-action" href={user ? '/app/home' : '/login'}>{user ? 'Workspace' : 'Login'}</Link>
      </div>
    </header>
  );
}
