
import { getCurrentUser } from '@/lib/auth';
import { PublicMobileNav } from './public-mobile-nav';
import {SiteTopbar} from './site-topbar';
import {providerWorkspaceCapabilities} from '@/lib/provider-workspace.js';
import type {SiteNavigationUser} from './site-navigation';

export async function PublicHeader({user:providedUser}:{user?:Awaited<ReturnType<typeof getCurrentUser>>}={}) {
  const user = providedUser===undefined?await getCurrentUser():providedUser;
  const capabilities=user?providerWorkspaceCapabilities(user):null;
  const navUser:SiteNavigationUser|null=user?{
    id:user.id,role:user.role,name:user.name,active:user.active,
    accountName:user.selected_business_workspace?.name||user.provider_account_name||user.organization_name||user.provider_business_name||user.name,
    canManageFleet:capabilities?.canManageFleet,drivesTruck:capabilities?.drivesTruck,
    capacityAllowed:user.selected_business_workspace?.permissions.capacity,
    trackingAllowed:user.selected_business_workspace?.permissions.tracking,
    canManageSupport:user.can_manage_support,canManageFeatured:user.can_manage_featured,
    canManageCustomers:user.can_manage_customers,canManageOperations:user.can_manage_operations,canManageTrust:user.can_manage_trust
  }:null;
  return (
    <>
      <SiteTopbar user={navUser}/>
      <PublicMobileNav user={navUser}/>
    </>
  );
}
