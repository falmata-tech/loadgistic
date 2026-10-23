import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {verificationBadgesFromApproved,truckAuthorizationBadgeFromApproved} from '../verification-summary.js';
import {readWindowedPage} from '../pagination.js';

const FLEET_ERRORS=['FORBIDDEN','SUBSCRIPTION_ACCESS_REQUIRED','NOT_FOUND','INVALID_DRIVER_ACCESS','DRIVER_ACCOUNT_CONFLICT','TRUCK_HAS_ACTIVE_TRACKING'];

function fleetError(fallback,error){
  const message=String(error?.message||'');
  const known=FLEET_ERRORS.find(code=>message.includes(code));
  return new Error(known||fallback,{cause:error});
}

export async function getSupabaseFleetDriverPage(user,options={}){
  const requestedSize=Number(options.pageSize);
  const pageSize=Number.isSafeInteger(requestedSize)&&requestedSize>0?requestedSize:10;
  const client=createSupabaseAdminClient();
  const result=await readWindowedPage(async(offset,limit)=>{
    // Every read, including the one bounded stale-page recovery, repeats the
    // current database owner check. A denial or outage is never an empty page.
    const {data,error}=await client.rpc('fleet_driver_page',{
      actor_user_id:user.id,requested_offset:offset,requested_limit:limit
    });
    if(error)throw fleetError('SUPABASE_FLEET_DRIVER_PAGE_FAILED',error);
    return data||[];
  },{page:options.page,pageSize});
  const items=result.items.map(driver=>{
    return {...driver,
      verification_badges:verificationBadgesFromApproved('DRIVER',driver.driver_documents||[]),
      truck_verification_badges:driver.assigned_vehicle_id
        ?[truckAuthorizationBadgeFromApproved(
          driver.authorization_documents||[],driver.assigned_vehicle_id,driver.assigned_vehicles
        )]:[],
      driver_documents:undefined,authorization_documents:undefined
    };
  });
  return {...result,items};
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
