import type { SupabaseClient } from '@supabase/supabase-js';

export type WorkspaceSubscription = {
  id:string;
  organization_id:string|null;
  provider_profile_id:string|null;
  plan_id:string;
  plan_name:string|null;
  plan_code:string|null;
  status:string;
  billing_model:string;
  starts_at:string;
  ends_at:string|null;
  updated_at:string;
};

export type ManagedCurrentUser = {
  id:string;
  email:string;
  phone:string|null;
  name:string;
  role:string;
  active:boolean;
  created_at:string;
  organization_id:string|null;
  organization_name:string|null;
  organization_handle:string|null;
  organization_type:string|null;
  provider_profile_id:string|null;
  provider_business_name:string|null;
  provider_handle:string|null;
  application_type:string|null;
  driver_kind:'SELF_MANAGED'|'COMPANY'|null;
  provider_operating_model:'FLEET_TRANSPORTER'|'COMPANY_DRIVER'|'OWNER_OPERATOR'|'SELF_MANAGED_DRIVER'|null;
  can_browse_load_board:boolean;
  can_contact_businesses:boolean;
  can_negotiate_loads:boolean;
  can_manage_capacity:boolean;
  can_manage_tracking:boolean;
  can_manage_customers:boolean;
  can_manage_operations:boolean;
  can_manage_trust:boolean;
  can_manage_billing:boolean;
  can_manage_support:boolean;
  workspace_subscription:WorkspaceSubscription|null;
};

function isManagedCurrentUser(value:unknown):value is ManagedCurrentUser{
  if(!value||typeof value!=='object')return false;
  const projection=value as Partial<ManagedCurrentUser>;
  return typeof projection.id==='string'
    &&typeof projection.email==='string'
    &&typeof projection.name==='string'
    &&typeof projection.role==='string'
    &&typeof projection.active==='boolean';
}

export async function getManagedCurrentUser(client:SupabaseClient,authUser:{id:string}):Promise<ManagedCurrentUser|null>{
  const {data,error}=await client.rpc('current_user_projection');
  if(error)throw new Error('MANAGED_IDENTITY_PROJECTION_FAILED',{cause:error});
  if(!isManagedCurrentUser(data)||data.id!==authUser.id)return null;
  return data;
}
