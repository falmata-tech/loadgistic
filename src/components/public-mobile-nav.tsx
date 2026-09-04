"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, Info, LayoutDashboard, LockKeyhole, LogIn, MapPinned, Route, Users } from 'lucide-react';
import React from 'react';

const destinations = [
  { key: 'market', href: '/', label: 'Open', desktopLabel: 'Open capacity', icon: MapPinned },
  { key: 'shared', href: '/shared-capacity', label: 'Private', desktopLabel: 'Private capacity', icon: LockKeyhole },
  { key: 'featured', href: '/featured', label: 'Featured', desktopLabel: 'Featured', icon: Users },
  { key: 'track', href: '/track', label: 'Track', desktopLabel: 'Track', icon: Route },
  { key: 'about', href: '/about', label: 'About', desktopLabel: 'About', icon: Info }
] as const;

function routeDestination(pathname: string) {
  if (pathname.startsWith('/shared-capacity')) return 'shared';
  if (pathname.startsWith('/help')) return 'help';
  if (pathname.startsWith('/track')) return 'track';
  if (pathname.startsWith('/featured')) return 'featured';
  if (pathname.startsWith('/providers/') || pathname.startsWith('/@')) return 'market';
  if (pathname.startsWith('/apply') || pathname.startsWith('/signup')) return 'join';
  if (pathname.startsWith('/privacy')) return 'privacy';
  if (pathname.startsWith('/terms')) return 'terms';
  if (pathname.startsWith('/login')) return 'login';
  if (pathname.startsWith('/about')) return 'about';
  return pathname === '/' ? 'market' : '';
}

export function PublicMobileNav({signedIn=false}:{signedIn?:boolean}) {
  const pathname = usePathname();
  const router=useRouter();
  const active=routeDestination(pathname);

  React.useEffect(() => {
    if(pathname==='/'&&window.location.hash==='#featured-providers')router.replace('/featured');
  },[pathname,router]);

  const destinationLink=(destination:{key:string;href:string;label:string;desktopLabel:string;icon:any},mobile:boolean,className?:string) => {
    const Icon = destination.icon;
    const isActive = active === destination.key;
    return (
      <Link
        key={destination.key}
        href={destination.href}
        className={[className,isActive?'active':''].filter(Boolean).join(' ')||undefined}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon aria-hidden="true" />
        <span>{mobile?destination.label:destination.desktopLabel}</span>
      </Link>
    );
  };

  const sessionDestination=signedIn
    ?{key:'dashboard',href:'/app/home',label:'Dashboard',desktopLabel:'Dashboard',icon:LayoutDashboard}
    :{key:'login',href:'/login',label:'Log in',desktopLabel:'Log in',icon:LogIn};

  return <>
    <nav className="public-workspace-nav" aria-label="Public workspace navigation">
      <span className="public-nav-group">Explore</span>
      {destinations.slice(0,4).map(destination=>destinationLink(destination,false))}
      <span className="public-nav-group">Account</span>
      {destinationLink(sessionDestination,false,'public-nav-secondary')}
      <span className="public-nav-group">Loadgistic</span>
      {destinationLink(destinations[4],false)}
      {destinationLink({key:'privacy',href:'/privacy',label:'Privacy',desktopLabel:'Privacy',icon:LockKeyhole},false,'public-nav-secondary')}
      {destinationLink({key:'terms',href:'/terms',label:'Terms',desktopLabel:'Terms',icon:FileText},false,'public-nav-secondary')}
    </nav>
    <nav className="public-mobile-nav" aria-label="Public mobile navigation">
      {destinations.slice(0,4).map(destination=>destinationLink(destination,true))}
      {destinationLink(destinations[4],true)}
    </nav>
  </>;
}
