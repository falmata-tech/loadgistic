"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Logo } from './logo';

const navigation: Record<string, Array<{ href: string; label: string; icon: string }>> = {
  SHIPPER: [
    { href: '/app/home', label: 'Home', icon: '⌂' },
    { href: '/app/shipments/new', label: 'New Shipment', icon: '+' },
    { href: '/app/shipments', label: 'Shipments', icon: '□' },
    { href: '/app/providers', label: 'Find Providers', icon: '⌕' },
    { href: '/app/capacity', label: 'Capacity', icon: '▤' },
    { href: '/app/company-page', label: 'Company Page', icon: '▣' },
    { href: '/app/more', label: 'More', icon: '•••' }
  ],
  RECEIVER: [
    { href: '/app/home', label: 'Home', icon: '⌂' },
    { href: '/app/shipments/new', label: 'New Shipment', icon: '+' },
    { href: '/app/shipments', label: 'Shipments', icon: '□' },
    { href: '/app/providers', label: 'Find Providers', icon: '⌕' },
    { href: '/app/capacity', label: 'Capacity', icon: '▤' },
    { href: '/app/company-page', label: 'Company Page', icon: '▣' },
    { href: '/app/more', label: 'More', icon: '•••' }
  ],
  PARCEL: [
    { href: '/app/home', label: 'Home', icon: '⌂' },
    { href: '/app/shipments', label: 'Requests', icon: '□' },
    { href: '/app/routes-centers', label: 'Routes & Centers', icon: '⌖' },
    { href: '/app/company-page', label: 'Company Page', icon: '▣' },
    { href: '/app/more', label: 'More', icon: '•••' }
  ],
  TRANSPORTER: [
    { href: '/app/home', label: 'Home', icon: '⌂' },
    { href: '/app/loads', label: 'Loads', icon: '▱' },
    { href: '/app/capacity', label: 'Capacity', icon: '▤' },
    { href: '/app/shipments', label: 'Shipments', icon: '□' },
    { href: '/app/company-page', label: 'Company Page', icon: '▣' },
    { href: '/app/more', label: 'More', icon: '•••' }
  ],
  DRIVER: [
    { href: '/app/home', label: 'Home', icon: '⌂' },
    { href: '/app/loads', label: 'Loads', icon: '▱' },
    { href: '/app/capacity', label: 'Capacity', icon: '▤' },
    { href: '/app/shipments', label: 'Shipments', icon: '□' },
    { href: '/app/company-page', label: 'Company Page', icon: '▣' },
    { href: '/app/more', label: 'More', icon: '•••' }
  ],
  ADMIN: [
    { href: '/app/home', label: 'Home', icon: '⌂' },
    { href: '/admin/applications', label: 'Applications', icon: '✓' },
    { href: '/admin/billing', label: 'Billing Review', icon: '₿' },
    { href: '/app/shipments', label: 'Shipments', icon: '□' },
    { href: '/companies', label: 'Companies', icon: '▣' },
    { href: '/app/more', label: 'More', icon: '•••' }
  ]
};

export function AppShell({ user, children }: { user: any; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = navigation[user.role] || navigation.SHIPPER;
  const mobileItems = items.slice(0, 5);
  const workspaceName = user.organization_name || user.provider_business_name || user.name;
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Logo href="/app/home" />
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {items.map(item => (
            <Link key={item.href} className={`nav-link ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'active' : ''}`} href={item.href}>
              <span aria-hidden="true">{item.icon}</span><span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-mini">
            <strong>{workspaceName}</strong>
            <div className="meta">{user.role.replaceAll('_',' ')}</div>
          </div>
          <form action="/api/auth/logout" method="post"><button className="button secondary" style={{ width: '100%' }}>Log out</button></form>
        </div>
      </aside>
      <main className="app-main">
        <header className="app-topbar">
          <div><strong>{workspaceName}</strong><div className="meta">B2B logistics workspace</div></div>
          <Link className="button secondary small" href="/app/more">Account</Link>
        </header>
        {children}
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobileItems.map(item => (
          <Link key={item.href} className={pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'active' : ''} href={item.href}>
            <span>{item.icon}</span><span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
