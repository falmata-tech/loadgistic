"use client";

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Logo } from './logo';
import {
  ClipboardCheck,
  CreditCard,
  Database,
  ExternalLink,
  Gauge,
  Headphones,
  Home,
  Menu,
  MoreHorizontal,
  Truck,
  UserRound
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LogoutButton } from './logout-button';
import { WorkspaceBackButton } from './workspace-back-button';

const navigation: Record<string, Array<{ href: string; label: string; icon: LucideIcon }>> = {
  TRANSPORTER: [
    { href: '/app/home', label: 'Home', icon: Home },
    { href: '/app/fleet', label: 'Fleet', icon: Truck },
    { href: '/app/provider-shipments', label: 'Tracking', icon: ClipboardCheck },
    { href: '/app/more', label: 'More', icon: MoreHorizontal }
  ],
  DRIVER: [
    { href: '/app/home', label: 'Home', icon: Home },
    { href: '/app/capacity', label: 'Capacity market', icon: Gauge },
    { href: '/app/provider-shipments', label: 'Tracking', icon: ClipboardCheck },
    { href: '/app/more', label: 'More', icon: MoreHorizontal }
  ],
  ADMIN: [
    { href: '/app/home', label: 'Home', icon: Home },
    { href: '/admin/operations', label: 'Operations', icon: Database },
    { href: '/admin/reviews', label: 'Review Center', icon: ClipboardCheck },
    { href: '/admin/support', label: 'Support', icon: Headphones },
    { href: '/app/more', label: 'More', icon: MoreHorizontal }
  ],
  SUPPORT: [
    { href: '/support', label: 'Inbox', icon: Headphones }
  ]
};

const mobileNavigation: Record<string, string[]> = {
  SHIPPER: ['/app/home', '/app/more'],
  RECEIVER: ['/app/home', '/app/more'],
  TRANSPORTER: ['/app/home', '/app/fleet', '/app/provider-shipments', '/app/more'],
  DRIVER: ['/app/home', '/app/capacity', '/app/provider-shipments', '/app/more'],
  ADMIN: ['/app/home', '/admin/operations', '/admin/reviews', '/admin/support', '/app/more'],
  SUPPORT: ['/support']
};

const roleLabels: Record<string, string> = {
  SHIPPER: 'Business',
  RECEIVER: 'Business',
  TRANSPORTER: 'Fleet transporter',
  DRIVER: 'Self-managed driver',
  ADMIN: 'Platform administrator',
  SUPPORT: 'Customer support'
};

const mobileLabels: Record<string, string> = {
  '/app/company-page': 'Profile',
  '/app/capacity': 'Market',
  '/app/provider-shipments': 'Tracking',
  '/admin/reviews': 'Reviews',
  '/admin/operations': 'Operations',
  '/admin/ratings': 'Rating Reviews',
  '/admin/billing': 'Billing',
  '/admin/support': 'Support'
};

export function AppShell({ user, children }: { user: any; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams=useSearchParams();
  let items = navigation[user.role] || navigation.SHIPPER;
  if(user.role==='SUPPORT'){
    items=[];
    if(user.can_manage_support)items.push({href:'/support',label:'Inbox',icon:Headphones});
    if(user.can_manage_customers||user.can_manage_operations)items.push({href:'/admin/operations',label:'Operations',icon:Database});
    if(user.can_manage_trust||user.can_manage_billing)items.push({href:'/admin/reviews',label:'Review Center',icon:ClipboardCheck});
  }
  if (user.driver_kind === 'COMPANY') {
    items = items.filter(item => item.href !== '/app/company-page');
  }
  if (user.billing_limited) {
    items = items
      .filter(item => ['/app/home','/app/more'].includes(item.href))
      .map(item => item.href === '/app/more' ? {...item,label:'Plan & billing',icon:CreditCard} : item);
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
  const mobileItems = user.role==='SUPPORT' ? items : user.billing_limited
    ? items.map(item=>({...item,label:item.href==='/app/more'?'Plan & billing':item.label}))
    : (mobileNavigation[user.role] || mobileNavigation.SHIPPER).map((href) => items.find((item) => item.href === href)).filter(Boolean).map((item) => ({...item!,label:mobileLabels[item!.href]||item!.label})) as Array<{ href: string; label: string; icon: LucideIcon }>;
  const workspaceName = user.organization_name || user.provider_business_name || user.name;
  const isSupport=user.role==='SUPPORT';
  const homeHref=isSupport?(items[0]?.href||'/login'):'/app/home';
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Logo href={homeHref} />
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
          <div className="topbar-leading"><WorkspaceBackButton/><div className="workspace-title"><strong>{workspaceName}</strong><div className="meta">{isSupport?'Customer support workspace':'B2B logistics workspace'}</div></div></div>
          <div className="topbar-actions">
            {user.role==='DRIVER'?<Link className="button secondary small desktop-account" href="/"><ExternalLink aria-hidden="true"/>Exit dashboard</Link>:null}
            {!isSupport&&!['ADMIN'].includes(user.role)?<Link className="button secondary small desktop-account" href="/app/support"><Headphones aria-hidden="true"/>Help</Link>:null}
            {!isSupport?<Link className="button secondary small desktop-account" href="/app/more"><UserRound aria-hidden="true"/>Account</Link>:null}
          </div>
          <details className="mobile-account-menu">
            <summary><Menu aria-hidden="true"/>Menu</summary>
            <div className="mobile-menu-panel">
              <nav aria-label="All workspace navigation">{items.map(item => <Link key={item.href} className={activeHref === item.href ? 'active' : ''} href={item.href}>{item.label}</Link>)}{user.role==='DRIVER'?<Link href="/">Exit dashboard</Link>:null}{!isSupport&&!['ADMIN'].includes(user.role)?<Link href="/app/support">Help</Link>:null}</nav>
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
