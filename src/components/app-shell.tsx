"use client";

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Logo } from './logo';
import {
  BadgeCheck,
  Building2,
  ClipboardCheck,
  Database,
  Home,
  LayoutList,
  Menu,
  MoreHorizontal,
  PackageSearch,
  Search,
  Star,
  Truck,
  Users,
  Network
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LogoutButton } from './logout-button';
import { WorkspaceBackButton } from './workspace-back-button';

const navigation: Record<string, Array<{ href: string; label: string; icon: LucideIcon }>> = {
  SHIPPER: [
    { href: '/app/home', label: 'Home', icon: Home },
    { href: '/app/shipments', label: 'My Loads', icon: ClipboardCheck },
    { href: '/app/providers', label: 'Directory', icon: Search },
    { href: '/app/network', label: 'My Network', icon: Network },
    { href: '/app/capacity', label: 'Capacity Board', icon: LayoutList },
    { href: '/app/company-page', label: 'Public Profile', icon: Building2 },
    { href: '/app/verification', label: 'Verification', icon: BadgeCheck },
    { href: '/app/more', label: 'More', icon: MoreHorizontal }
  ],
  RECEIVER: [
    { href: '/app/home', label: 'Home', icon: Home },
    { href: '/app/shipments', label: 'My Loads', icon: ClipboardCheck },
    { href: '/app/providers', label: 'Directory', icon: Search },
    { href: '/app/network', label: 'My Network', icon: Network },
    { href: '/app/capacity', label: 'Capacity Board', icon: LayoutList },
    { href: '/app/company-page', label: 'Public Profile', icon: Building2 },
    { href: '/app/verification', label: 'Verification', icon: BadgeCheck },
    { href: '/app/more', label: 'More', icon: MoreHorizontal }
  ],
  TRANSPORTER: [
    { href: '/app/home', label: 'Home', icon: Home },
    { href: '/app/fleet', label: 'Fleet', icon: Truck },
    { href: '/app/loads', label: 'Load Board', icon: LayoutList },
    { href: '/app/capacity', label: 'Capacity Board', icon: PackageSearch },
    { href: '/app/shipments', label: 'Tracking', icon: ClipboardCheck },
    { href: '/app/providers', label: 'Directory', icon: Users },
    { href: '/app/network', label: 'My Network', icon: Network },
    { href: '/app/company-page', label: 'Public Profile', icon: Building2 },
    { href: '/app/verification', label: 'Verification', icon: BadgeCheck },
    { href: '/app/more', label: 'More', icon: MoreHorizontal }
  ],
  DRIVER: [
    { href: '/app/home', label: 'Home', icon: Home },
    { href: '/app/loads', label: 'Load Board', icon: LayoutList },
    { href: '/app/capacity', label: 'Capacity Board', icon: PackageSearch },
    { href: '/app/shipments', label: 'Tracking', icon: ClipboardCheck },
    { href: '/app/providers', label: 'Directory', icon: Users },
    { href: '/app/network', label: 'My Network', icon: Network },
    { href: '/app/company-page', label: 'Public Profile', icon: Building2 },
    { href: '/app/verification', label: 'Verification', icon: BadgeCheck },
    { href: '/app/more', label: 'More', icon: MoreHorizontal }
  ],
  ADMIN: [
    { href: '/app/home', label: 'Home', icon: Home },
    { href: '/admin/operations', label: 'Operations', icon: Database },
    { href: '/admin/applications', label: 'Applications', icon: ClipboardCheck },
    { href: '/admin/verifications', label: 'Verifications', icon: BadgeCheck },
    { href: '/admin/ratings', label: 'Rating Reviews', icon: Star },
    { href: '/admin/billing', label: 'Billing Review', icon: ClipboardCheck },
    { href: '/app/shipments', label: 'Tracking', icon: PackageSearch },
    { href: '/app/providers', label: 'Directory', icon: Users },
    { href: '/app/more', label: 'More', icon: MoreHorizontal }
  ]
};

const mobileNavigation: Record<string, string[]> = {
  SHIPPER: ['/app/home', '/app/shipments', '/app/providers', '/app/capacity', '/app/more'],
  RECEIVER: ['/app/home', '/app/shipments', '/app/providers', '/app/capacity', '/app/more'],
  TRANSPORTER: ['/app/home', '/app/fleet', '/app/loads', '/app/shipments', '/app/more'],
  DRIVER: ['/app/home', '/app/loads', '/app/shipments', '/app/providers', '/app/more'],
  ADMIN: ['/app/home', '/admin/operations', '/admin/applications', '/app/shipments', '/app/more']
};

const roleLabels: Record<string, string> = {
  SHIPPER: 'Business',
  RECEIVER: 'Business',
  TRANSPORTER: 'Fleet transporter',
  DRIVER: 'Self-managed driver',
  ADMIN: 'Platform administrator'
};

const mobileLabels: Record<string, string> = {
  '/app/company-page': 'Profile',
  '/app/loads': 'Loads',
  '/app/capacity': 'Capacity',
  '/admin/applications': 'Applications',
  '/admin/operations': 'Operations',
  '/admin/ratings': 'Rating Reviews',
  '/admin/billing': 'Billing'
};

export function AppShell({ user, children }: { user: any; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams=useSearchParams();
  let items = navigation[user.role] || navigation.SHIPPER;
  if (user.driver_kind === 'COMPANY') {
    items = items.filter(item => item.href !== '/app/company-page' && (item.href !== '/app/loads' || Boolean(user.can_browse_load_board)));
  }
  const activeHref = items.filter(item=>{
    const [itemPath,itemQuery]=item.href.split('?');
    if(pathname!==itemPath&&!pathname.startsWith(`${itemPath}/`))return false;
    if(itemQuery){
      const expected=new URLSearchParams(itemQuery);
      return [...expected.entries()].every(([key,value])=>searchParams.get(key)===value);
    }
    return true;
  }).sort((a,b)=>b.href.length-a.href.length)[0]?.href;
  const mobileItems = (mobileNavigation[user.role] || mobileNavigation.SHIPPER).map((href) => items.find((item) => item.href === href)).filter(Boolean).map((item) => ({...item!,label:mobileLabels[item!.href]||item!.label})) as Array<{ href: string; label: string; icon: LucideIcon }>;
  const workspaceName = user.organization_name || user.provider_business_name || user.name;
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Logo href="/app/home" />
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {items.map(item => {
            const Icon=item.icon;
            return (
            <Link key={item.href} className={`nav-link ${activeHref === item.href ? 'active' : ''}`} href={item.href}>
              <Icon aria-hidden="true"/><span>{item.label}</span>
            </Link>
          )})}
        </nav>
        <div className="sidebar-foot">
          <div className="user-mini">
            <strong>{workspaceName}</strong>
            <div className="meta">{user.driver_kind==='COMPANY'?'Company driver':roleLabels[user.role] || user.role.replaceAll('_',' ')}</div>
          </div>
          <LogoutButton/>
        </div>
      </aside>
      <main className="app-main">
        <header className="app-topbar">
          <div className="topbar-leading"><WorkspaceBackButton/><div className="workspace-title"><strong>{workspaceName}</strong><div className="meta">B2B logistics workspace</div></div></div>
          <Link className="button secondary small desktop-account" href="/app/more">Account</Link>
          <details className="mobile-account-menu">
            <summary><Menu aria-hidden="true"/>Menu</summary>
            <div className="mobile-menu-panel">
              <nav aria-label="All workspace navigation">{items.map(item => <Link key={item.href} className={activeHref === item.href ? 'active' : ''} href={item.href}>{item.label}</Link>)}</nav>
              <LogoutButton compact/>
            </div>
          </details>
        </header>
        {children}
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobileItems.map(item => {
          const Icon=item.icon;
          return (
          <Link key={item.href} className={activeHref === item.href ? 'active' : ''} href={item.href}>
            <Icon aria-hidden="true"/><span>{item.label}</span>
          </Link>
        )})}
      </nav>
    </div>
  );
}
