import { subscriptionAccess } from '../subscription-access.js';

export function getManagedWorkspaceAccess(user,at=new Date()){
  if(['ADMIN','SUPPORT'].includes(user.role)){
    return {granted:true,status:user.role,ends_at:null,days_remaining:null,subscription:null};
  }
  const subscription=user.workspace_subscription||null;
  return {...subscriptionAccess(subscription,at),subscription};
}

export function getManagedDriverAccess(user){
  if(user.role!=='DRIVER')return null;
  if(user.provider_profile_id){
    return {
      kind:'SELF_MANAGED',can_browse_load_board:false,can_contact_businesses:false,
      can_negotiate_loads:false,can_manage_capacity:true,can_manage_tracking:true
    };
  }
  if(!user.organization_id)return null;
  return {
    kind:'COMPANY',can_browse_load_board:false,can_contact_businesses:false,
    can_negotiate_loads:false,can_manage_capacity:Boolean(user.can_manage_capacity),
    can_manage_tracking:Boolean(user.can_manage_tracking)
  };
}
