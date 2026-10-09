export function getManagedWorkspaceAccess(user,_at=new Date()){
  const result={ends_at:null,days_remaining:null,subscription:null};
  if(!user?.active)return {...result,granted:false,status:'ACCOUNT_UNAVAILABLE'};
  if(['ADMIN','SUPPORT'].includes(user.role)){
    return {...result,granted:true,status:user.role};
  }
  const granted=['TRANSPORTER','DRIVER'].includes(user.role)&&Boolean(user.organization_id||user.provider_profile_id);
  return {...result,granted,status:granted?'FREE_ACCESS':'WORKSPACE_REQUIRED'};
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
