import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {verificationBadgesFromApproved,truckAuthorizationBadgeFromApproved} from '../verification-summary.js';

const FLEET_ERRORS=['FORBIDDEN','SUBSCRIPTION_ACCESS_REQUIRED','NOT_FOUND','INVALID_DRIVER_ACCESS'];

function fleetError(fallback,error){
  const message=String(error?.message||'');
  const known=FLEET_ERRORS.find(code=>message.includes(code));
  return new Error(known||fallback,{cause:error});
}

function payload(value){
  return value&&typeof value==='object'&&'payload' in value?value.payload:value;
}

export async function getSupabaseFleetDriverPage(user,options={}){
  const pageSize=Math.max(1,Math.min(50,Number(options.pageSize)||10));
  const page=Math.max(1,Number(options.page)||1);
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('fleet_driver_page',{
    actor_user_id:user.id,requested_offset:(page-1)*pageSize,requested_limit:pageSize
  });
  if(error)throw fleetError('SUPABASE_FLEET_DRIVER_PAGE_FAILED',error);
  const rows=data||[];
  const items=rows.map(entry=>{
    const driver=payload(entry)||{};
    return {...driver,
      verification_badges:verificationBadgesFromApproved('DRIVER',driver.driver_documents||[]),
      truck_verification_badges:driver.assigned_vehicle_id
        ?[truckAuthorizationBadgeFromApproved(
          driver.authorization_documents||[],driver.assigned_vehicle_id,driver.assigned_vehicles
        )]:[],
      driver_documents:undefined,authorization_documents:undefined
    };
  });
  const total=Number(rows[0]?.total_count||0);
  return {items,total,page,pageSize,pageCount:Math.max(1,Math.ceil(total/pageSize))};
}

export async function updateSupabaseFleetDriverAccess(user,driverUserId,input){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('update_fleet_driver_access',{
    actor_user_id:user.id,
    command:{
      driver_user_id:String(driverUserId||''),
      vehicle_id:String(input.vehicleId||''),
      can_manage_capacity:Boolean(input.canManageCapacity),
      can_manage_tracking:Boolean(input.canManageTracking)
    }
  });
  if(error)throw fleetError('SUPABASE_FLEET_DRIVER_UPDATE_FAILED',error);
  return data;
}
