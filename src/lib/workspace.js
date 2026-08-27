import {getManagedWorkspaceAccess} from './identity/workspace-access.js';
import {createSupabaseAdminClient} from './supabase-adapter.js';

export const PLATFORM_PERMISSIONS=Object.freeze({
  CUSTOMERS:'CUSTOMERS',OPERATIONS:'OPERATIONS',TRUST:'TRUST',BILLING:'BILLING',SUPPORT:'SUPPORT'
});

const PLATFORM_PERMISSION_FIELDS=Object.freeze({
  CUSTOMERS:'can_manage_customers',OPERATIONS:'can_manage_operations',TRUST:'can_manage_trust',
  BILLING:'can_manage_billing',SUPPORT:'can_manage_support'
});

export function getWorkspaceAccess(user,at=new Date()){
  return getManagedWorkspaceAccess(user,at);
}

export function hasPlatformPermission(user,permission){
  if(user?.role==='ADMIN')return true;
  const field=PLATFORM_PERMISSION_FIELDS[permission];
  return Boolean(field&&user?.role==='SUPPORT'&&user[field]);
}

export function assertPlatformPermission(user,permission){
  if(!hasPlatformPermission(user,permission))throw new Error('FORBIDDEN');
}

function dashboardActions(user){
  if(user.role==='ADMIN')return [
    {href:'/admin/operations',label:'Open platform operations',description:'Inspect one focused client, truck, shipment, or capacity view.'},
    {href:'/admin/reviews?tab=ratings',label:'Review rating disputes',description:'Investigate transporter disputes without hiding published customer ratings.'},
    {href:'/admin/reviews?tab=documents',label:'Review trust documents',description:'Verify identities, licenses, drivers, and trucks.'},
    {href:'/',label:'View public Truck Market',description:'Inspect published capacity and transporter pages as a visitor sees them.'}
  ];
  return [
    {href:'/app/provider-shipments/new',label:'Start Tracking',description:'Create a transporter-managed Tracking session after agreeing transport work offline.'},
    {href:user.role==='TRANSPORTER'?'/app/fleet':'/app/home',label:'Update capacity',description:'Publish Empty or Partial truck availability.'},
    {href:'/app/company-page',label:'Update public page',description:'Keep your services, business information, and public contact choices current.'}
  ];
}

export async function getDashboard(user){
  const access=getWorkspaceAccess(user);
  if(!access.granted)throw new Error('SUBSCRIPTION_ACCESS_REQUIRED');
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('workspace_dashboard',{actor_user_id:user.id});
  if(error)throw new Error('SUPABASE_WORKSPACE_DASHBOARD_FAILED',{cause:error});
  return {...(data||{}),role:user.role,actions:dashboardActions(user),capacities:[]};
}

export async function getBillingSummary(user){
  const subscription=user.workspace_subscription||null;
  const access=getWorkspaceAccess(user);
  if(!subscription)return {subscription:null,proofs:[],access};
  const client=createSupabaseAdminClient();
  const {data,error}=await client.from('payment_proofs')
    .select('id,subscription_id,amount_minor,reference,file_path,original_name,mime_type,status,submitted_at,reviewed_at')
    .eq('subscription_id',subscription.id)
    .order('submitted_at',{ascending:false})
    .limit(100);
  if(error)throw new Error('SUPABASE_BILLING_SUMMARY_FAILED',{cause:error});
  return {subscription,proofs:data||[],access};
}
