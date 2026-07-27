"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Logo } from './logo';

const navigation: Record<string, Array<{ href: string; label: string; icon: string }>> = {
  SHIPPER: [
    { href: '/app/home', label: 'Home', icon: '⌂' },
    { href: '/app/shipments/new', label: 'New Shipment', icon: '+' },
    { href: '/app/shipments', label: 'Shipments', icon: '□' },
    { href: '/app/providers', label: 'Transporters', icon: '⌕' },
    { href: '/app/capacity', label: 'Capacity Board', icon: '▤' },
    { href: '/app/company-page', label: 'Business Profile', icon: '▣' },
    { href: '/app/more', label: 'More', icon: '•••' }
  ],
  RECEIVER: [
    { href: '/app/home', label: 'Home', icon: '⌂' },
    { href: '/app/shipments/new', label: 'New Shipment', icon: '+' },
    { href: '/app/shipments', label: 'Shipments', icon: '□' },
    { href: '/app/providers', label: 'Transporters', icon: '⌕' },
    { href: '/app/capacity', label: 'Capacity Board', icon: '▤' },
    { href: '/app/company-page', label: 'Business Profile', icon: '▣' },
    { href: '/app/more', label: 'More', icon: '•••' }
  ],
  TRANSPORTER: [
    { href: '/app/home', label: 'Home', icon: '⌂' },
    { href: '/app/fleet', label: 'Fleet', icon: '▦' },
    { href: '/app/loads', label: 'Load Board', icon: '▱' },
    { href: '/app/capacity', label: 'Capacity Board', icon: '▤' },
    { href: '/app/shipments', label: 'Shipments', icon: '□' },
    { href: '/app/company-page', label: 'Public Profile', icon: '▣' },
    { href: '/app/more', label: 'More', icon: '•••' }
  ],
  DRIVER: [
    { href: '/app/home', label: 'Home', icon: '⌂' },
    { href: '/app/loads', label: 'Load Board', icon: '▱' },
    { href: '/app/capacity', label: 'Capacity Board', icon: '▤' },
    { href: '/app/shipments', label: 'Shipments', icon: '□' },
    { href: '/app/company-page', label: 'Public Profile', icon: '▣' },
    { href: '/app/more', label: 'More', icon: '•••' }
  ],
  ADMIN: [
    { href: '/app/home', label: 'Home', icon: '⌂' },
    { href: '/admin/applications', label: 'Applications', icon: '✓' },
    { href: '/admin/billing', label: 'Billing Review', icon: '₿' },
    { href: '/app/shipments', label: 'Shipments', icon: '□' },
    { href: '/companies', label: 'Transporters', icon: '▣' },
    { href: '/app/more', label: 'More', icon: '•••' }
  ]
};

const mobileNavigation: Record<string, string[]> = {
  SHIPPER: ['/app/home', '/app/shipments/new', '/app/providers', '/app/capacity', '/app/more'],
  RECEIVER: ['/app/home', '/app/shipments/new', '/app/providers', '/app/capacity', '/app/more'],
  TRANSPORTER: ['/app/home', '/app/fleet', '/app/loads', '/app/capacity', '/app/more'],
  DRIVER: ['/app/home', '/app/loads', '/app/capacity', '/app/shipments', '/app/more'],
  ADMIN: ['/app/home', '/admin/applications', '/admin/billing', '/app/shipments', '/app/more']
};

const roleLabels: Record<string, string> = {
  SHIPPER: 'Business',
  RECEIVER: 'Business',
  TRANSPORTER: 'Fleet transporter',
  DRIVER: 'Self-managed driver',
  ADMIN: 'Platform administrator'
};

const mobileLabels: Record<string, string> = {
  '/app/shipments/new': 'New',
  '/app/company-page': 'Profile',
  '/app/loads': 'Loads',
  '/app/capacity': 'Capacity',
  '/admin/applications': 'Applications',
  '/admin/billing': 'Billing'
};

export function AppShell({ user, children }: { user: any; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = navigation[user.role] || navigation.SHIPPER;
  const activeHref = items.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort((a,b) => b.href.length-a.href.length)[0]?.href;
  const mobileItems = (mobileNavigation[user.role] || mobileNavigation.SHIPPER).map((href) => items.find((item) => item.href === href)).filter(Boolean).map((item) => ({...item!,label:mobileLabels[item!.href]||item!.label})) as Array<{ href: string; label: string; icon: string }>;
  const workspaceName = user.organization_name || user.provider_business_name || user.name;
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Logo href="/app/home" />
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {items.map(item => (
            <Link key={item.href} className={`nav-link ${activeHref === item.href ? 'active' : ''}`} href={item.href}>
              <span aria-hidden="true">{item.icon}</span><span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-mini">
            <strong>{workspaceName}</strong>
            <div className="meta">{roleLabels[user.role] || user.role.replaceAll('_',' ')}</div>
          </div>
          <form action="/api/auth/logout" method="post"><button className="button secondary" style={{ width: '100%' }}>Log out</button></form>
        </div>
      </aside>
      <main className="app-main">
        <header className="app-topbar">
          <div className="workspace-title"><strong>{workspaceName}</strong><div className="meta">B2B logistics workspace</div></div>
          <Link className="button secondary small desktop-account" href="/app/more">Account</Link>
          <details className="mobile-account-menu">
            <summary>Menu</summary>
            <div className="mobile-menu-panel">
              <nav aria-label="All workspace navigation">{items.map(item => <Link key={item.href} className={activeHref === item.href ? 'active' : ''} href={item.href}>{item.label}</Link>)}</nav>
              <form action="/api/auth/logout" method="post"><button className="button secondary">Log out</button></form>
            </div>
          </details>
        </header>
        {children}
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobileItems.map(item => (
          <Link key={item.href} className={activeHref === item.href ? 'active' : ''} href={item.href}>
            <span>{item.icon}</span><span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
