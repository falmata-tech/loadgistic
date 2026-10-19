"use client";


import {Localized,Text} from '@/components/localization';
import {ContentPolicyConsent} from './content-policy-consent';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {LanguagePicker} from './localization';
import { Logo } from './logo';
import {
  ClipboardCheck,
  CreditCard,
  Users,
  Headphones,
  Home,
  MoreHorizontal,
  Network,
  MapPinned,
  ArrowLeftRight,
  Sparkles,
  Truck,
  UserRound
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {StaffAccount} from './staff-account';
import staffStyles from './staff-account.module.css';
import shellStyles from './workspace-shell.module.css';
import {WorkspaceAreaSwitch} from './workspace-area-switch';
import { WorkspaceBackButton } from './workspace-back-button';
import {ChatAlerts} from './chat-alerts';
import {providerWorkspaceCapabilities} from '@/lib/provider-workspace.js';

const navigation: Record<string, Array<{ href: string; label: string; icon: LucideIcon }>> = {
  CUSTOMER: [
    {href:'/app/business/capacity',label:'Capacity',icon:MapPinned},
    {href:'/app/business/tracking',label:'Tracking',icon:ClipboardCheck},
    {href:'/app/business/account',label:'Account',icon:UserRound},
  ],
  TRANSPORTER: [
    { href: '/app/home', label: 'Home', icon: Home },
    { href: '/app/network', label: 'Network', icon: Network },
    { href: '/app/provider-shipments', label: 'Tracking', icon: ClipboardCheck },
    { href: '/app/more', label: 'Account', icon: UserRound },
  ],
  DRIVER: [
    { href: '/app/home', label: 'Home', icon: Home },
    { href: '/app/fleet', label: 'Fleet', icon: Truck },
    { href: '/app/provider-shipments', label: 'Tracking', icon: ClipboardCheck },
    { href: '/app/network', label: 'Network', icon: Network },
    { href: '/app/more', label: 'Account', icon: UserRound },
  ],
  ADMIN: [
    { href: '/admin', label: 'Overview', icon: Home },
    { href: '/admin/operations', label: 'Accounts', icon: Users },
    { href: '/admin/featured', label: 'Featured', icon: Sparkles },
    { href: '/admin/reviews', label: 'Review Center', icon: ClipboardCheck },
    { href: '/admin/support', label: 'Support', icon: Headphones },
    { href: '/app/menu', label: 'More', icon: MoreHorizontal }
  ],
  SUPPORT: [
    { href: '/support', label: 'Inbox', icon: Headphones }
  ]
};

const mobileNavigation: Record<string, string[]> = {
  CUSTOMER: ['/app/business/capacity','/app/business/tracking','/app/business/account'],
  SHIPPER: ['/app/home', '/app/more'],
  RECEIVER: ['/app/home', '/app/more'],
  TRANSPORTER: ['/app/home', '/app/network', '/app/provider-shipments', '/app/more'],
  DRIVER: ['/app/home', '/app/fleet', '/app/provider-shipments', '/app/network', '/app/more'],
  ADMIN: ['/admin', '/admin/support', '/admin/operations', '/admin/featured', '/app/menu'],
  SUPPORT: ['/support']
};

const roleLabels: Record<string, string> = {
  CUSTOMER: 'Business workspace',
  SHIPPER: 'Business',
  RECEIVER: 'Business',
  TRANSPORTER: 'Transport Provider',
  DRIVER: 'Transport Provider',
  ADMIN: 'Platform administrator',
  SUPPORT: 'Customer support'
};

function workspaceRoleLabel(user:any) {
  if(user.role==='CUSTOMER')return user.selected_business_workspace?.membershipRole==='OWNER'?'Owner':user.selected_business_workspace?.membershipRole==='ADMIN'?'Business admin':'Team member';
  if(user.role==='SUPPORT'){
    const responsibilities=[['can_manage_featured','Featured'],['can_manage_support','Support'],['can_manage_customers','Customers'],['can_manage_operations','Operations'],['can_manage_trust','Trust']].filter(([field])=>user[field]);
    return responsibilities.length===1?responsibilities[0][1]:'Platform team';
  }
  if(user.provider_operating_model==='COMPANY_DRIVER')return 'Company driver';
  if(['TRANSPORTER','DRIVER'].includes(user.role))return 'Transport Provider';
  return roleLabels[user.role] || user.role.replaceAll('_',' ');
}

const mobileLabels: Record<string, string> = {
  '/app/company-page': 'Profile',
  '/app/menu': 'More',
  '/app/provider-shipments': 'Tracking',
  '/app/network': 'Network',
  '/admin/reviews': 'Reviews',
  '/admin': 'Overview',
  '/admin/operations': 'Accounts',
  '/admin/featured': 'Featured',
  '/admin/ratings': 'Rating Reviews',
  '/admin/support': 'Support'
};

export function AppShell({ user, children }: { user: any; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams=useSearchParams();
  const capabilities=providerWorkspaceCapabilities(user);
  let items = navigation[user.role] || navigation.SHIPPER;
  if(user.role==='CUSTOMER')items=items.filter(item=>!item.href.endsWith('/capacity')||user.selected_business_workspace?.permissions.capacity).filter(item=>!item.href.endsWith('/tracking')||user.selected_business_workspace?.permissions.tracking);
  if(user.role==='SUPPORT'){
    items=[];
    if(user.can_manage_support)items.push({href:'/support',label:'Support',icon:Headphones});
    if(user.can_manage_featured)items.push({href:'/admin/featured',label:'Featured',icon:Sparkles});
    if(user.can_manage_customers||user.can_manage_operations)items.push({href:user.can_manage_customers?'/admin/operations':'/admin/operations?view=TRUCKS',label:user.can_manage_customers?'Accounts':'Fleet',icon:user.can_manage_customers?Users:Truck});
    if(user.can_manage_trust)items.push({href:'/admin/reviews',label:'Review Center',icon:ClipboardCheck});
  }
  if (user.driver_kind === 'COMPANY') {
    items = items.filter(item => !['/app/company-page','/app/fleet'].includes(item.href));
  }
  if(capabilities.canManageFleet&&capabilities.drivesTruck&&!items.some(item=>item.href==='/app/fleet'))items=[items[0],{href:'/app/fleet',label:'Fleet',icon:Truck},...items.slice(1)];
  if(capabilities.canManageFleet&&!capabilities.drivesTruck)items=items.filter(item=>item.href!=='/app/fleet');
  const activeHref = items.filter(item=>{
    const [itemPath,itemQuery]=item.href.split('?');
    if(pathname!==itemPath&&!pathname.startsWith(`${itemPath}/`))return false;
    if(itemQuery){
      if(user.role==='SUPPORT'&&itemPath==='/admin/operations')return true;
      const expected=new URLSearchParams(itemQuery);
      return [...expected.entries()].every(([key,value])=>searchParams.get(key)===value);
    }
    return true;
  }).sort((a,b)=>b.href.length-a.href.length)[0]?.href;
  const selectedHref=user.role==='ADMIN'&&pathname.startsWith('/support')?'/admin/support':capabilities.canManageFleet&&!capabilities.drivesTruck&&pathname.startsWith('/app/fleet')?'/app/home':activeHref;
  const providerMobile=capabilities.canManageFleet?[ '/app/home',...(capabilities.drivesTruck?['/app/fleet']:[]),'/app/provider-shipments','/app/network','/app/more']:mobileNavigation[user.role];
  const mobileItems = user.role==='SUPPORT' ? items : (providerMobile || mobileNavigation.SHIPPER).map((href) => items.find((item) => item.href === href)).filter(Boolean).map((item) => ({...item!,label:mobileLabels[item!.href]||item!.label})) as Array<{ href: string; label: string; icon: LucideIcon }>;
  const workspaceName = user.selected_business_workspace?.name || user.provider_account_name || user.organization_name || user.provider_business_name || user.name;
  const workspaceRole=workspaceRoleLabel(user);
  const isSupport=user.role==='SUPPORT';
  const homeHref=isSupport?(items[0]?.href||'/login'):user.role==='ADMIN'?'/admin':user.role==='CUSTOMER'?(items[0]?.href||'/app/business/account'):'/app/home';
  return (
    <div className={`app-frame ${['TRANSPORTER','DRIVER','CUSTOMER'].includes(user.role)?shellStyles.providerFrame:''}`}>
      <aside className="sidebar">
        <Logo href={homeHref} />
        <Localized as="nav" copy={["aria-label"]} className="sidebar-nav" aria-label="Workspace navigation">
          {items.map(item => {
            const Icon=item.icon;
            return (
            <Link key={item.href} className={`nav-link ${selectedHref === item.href ? 'active' : ''}`} href={item.href} aria-current={selectedHref===item.href?'page':undefined}>
              <Icon aria-hidden="true"/><span>{<Text message={item.label}/>}</span>
            </Link>
          )})}
        </Localized>
        <div className="sidebar-foot">
          <div className="user-mini">
            <strong>{workspaceName}</strong>
            <div className="meta"><Text message={workspaceRole}/></div>
          </div>
        </div>
      </aside>
      <main className={`app-main ${user.role==='CUSTOMER'?shellStyles.customerMain:''}`}>
        <header className={`app-topbar ${['TRANSPORTER','DRIVER','CUSTOMER'].includes(user.role)?'provider-topbar':''} ${isSupport?staffStyles.header:''}`}>
          <div className="topbar-leading"><WorkspaceBackButton/><span className="mobile-app-brand"><Logo href={homeHref}/></span><div className="workspace-title"><strong>{workspaceName}</strong><div className="meta">{<Text message={workspaceRole}/>}</div></div></div>
          <div className={`topbar-actions ${isSupport?staffStyles.staffTopbar:''}`}>
            {(user.role!=='SUPPORT'||user.can_manage_support) ? <ChatAlerts identity={user.id} allowHandoverAlerts={user.active===true&&['DRIVER','TRANSPORTER'].includes(user.platform_role||user.role)}/> : null}
            <LanguagePicker/>
            {!isSupport&&user.role!=='ADMIN'?<Link className="button secondary small" href="/workspaces"><ArrowLeftRight aria-hidden="true"/><span className="workspace-support-label"><Text message="Switch workspace"/></span></Link>:null}
            {isSupport?<StaffAccount name={workspaceName}/>:null}
            {['TRANSPORTER','DRIVER'].includes(user.role)?<Link className="button secondary small workspace-support-shortcut" href="/app/support"><Headphones aria-hidden="true"/><span className="workspace-support-label"><Text message="Support"/></span></Link>:null}
            {!isSupport&&!['TRANSPORTER','DRIVER','CUSTOMER'].includes(user.role)?<Link className="button secondary small desktop-account" href="/app/menu"><MoreHorizontal aria-hidden="true"/><Text message="More"/></Link>:null}
          </div>
        </header>
        {['TRANSPORTER','DRIVER','CUSTOMER'].includes(user.role)?<WorkspaceAreaSwitch area="workspace" actorId={user.selected_business_workspace?`${user.id}:business:${user.selected_business_workspace.id}`:user.id}/>:null}
        {children}
        {['TRANSPORTER','DRIVER','CUSTOMER'].includes(user.role)?<ContentPolicyConsent key={user.id} actorId={user.id}/>:null}
      </main>
      <Localized as="nav" copy={["aria-label"]} className="mobile-nav" aria-label="Mobile navigation">
        {mobileItems.map(item => {
          const Icon=item.icon;
          return (
          <Link key={item.href} className={selectedHref === item.href ? 'active' : ''} href={item.href} aria-current={selectedHref===item.href?'page':undefined}>
            <Icon aria-hidden="true"/><span>{<Text message={item.label}/>}</span>
          </Link>
        )})}
      </Localized>
    </div>
  );
}
