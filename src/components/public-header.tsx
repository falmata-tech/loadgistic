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
          <Link href="/app/providers">Directory</Link>
          <Link href="/#how">How It Works</Link>
          <Link href="/#plans">Plans</Link>
          {user ? <Link className="button" href="/app/home">Workspace</Link> : <><Link className="button" href="/apply">Sign up</Link><Link className="button" href="/login">Log in</Link></>}
        </nav>
        <div className="public-session-compact" data-testid="public-session-action">
          {user
            ? <Link className="button" href="/app/home">Workspace</Link>
            : <><Link className="button" href="/apply">Sign up</Link><Link className="button" href="/login">Log in</Link></>}
        </div>
      </div>
    </header>
  );
}
