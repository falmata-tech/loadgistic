import Link from 'next/link';
import { Logo } from './logo';

export function PublicHeader() {
  return (
    <header className="public-header">
      <div className="container public-nav">
        <Logo />
        <nav className="public-links" aria-label="Public navigation">
          <Link href="/#solutions">Solutions</Link>
          <Link href="/companies">Company Pages</Link>
          <Link href="/#how">How It Works</Link>
          <Link href="/#plans">Plans</Link>
          <Link href="/apply">Apply</Link><Link href="/login">Login</Link>
          <Link className="button" href="/login">Get Started</Link>
        </nav>
        <Link className="button secondary" href="/login">Login</Link>
      </div>
    </header>
  );
}
