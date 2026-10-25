'use client';
import {ContentPolicyConsent} from './content-policy-consent';
import {PublicMobileNav} from './public-mobile-nav';
import {SiteTopbar} from './site-topbar';
import {WorkspaceBackButton} from './workspace-back-button';
import {providerWorkspaceCapabilities} from '@/lib/provider-workspace.js';
import type {SiteNavigationUser} from './site-navigation';

export function AppShell({user,children}:{user:any;children:React.ReactNode}){
 const capabilities=providerWorkspaceCapabilities(user);
 const navUser:SiteNavigationUser={
  id:user.id,role:user.role,name:user.name,active:user.active,
  accountName:user.selected_business_workspace?.name||user.provider_account_name||user.organization_name||user.provider_business_name||user.name,
  canManageFleet:capabilities.canManageFleet,drivesTruck:capabilities.drivesTruck,
  capacityAllowed:user.selected_business_workspace?.permissions.capacity,
  trackingAllowed:user.selected_business_workspace?.permissions.tracking,
  canManageSupport:user.can_manage_support,canManageFeatured:user.can_manage_featured,
  canManageCustomers:user.can_manage_customers,canManageOperations:user.can_manage_operations,canManageTrust:user.can_manage_trust
 };
 return <div className="unified-app-frame">
  <SiteTopbar user={navUser}/>
  <PublicMobileNav user={navUser}/>
  <main className="app-main unified-app-main">
   <WorkspaceBackButton/>
   {children}
   {['TRANSPORTER','DRIVER','CUSTOMER'].includes(user.role)?<ContentPolicyConsent key={user.id} actorId={user.id}/>:null}
  </main>
 </div>;
}
