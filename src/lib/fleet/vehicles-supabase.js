import {createSupabaseAdminClient} from '../supabase-adapter.js';

const VEHICLE_ERRORS=[
  'FORBIDDEN','SUBSCRIPTION_ACCESS_REQUIRED','INVALID_VEHICLE_INPUT','INVALID_VEHICLE_MAKE',
  'INVALID_VEHICLE_MODEL','INVALID_VEHICLE_PLATE','INVALID_VEHICLE_CONFIGURATION'
];

function vehicleError(error){
  const message=String(error?.message||'');
  return new Error(VEHICLE_ERRORS.find(code=>message.includes(code))||'SUPABASE_VEHICLE_CREATE_FAILED',{cause:error});
}

export async function createSupabaseProviderVehicle(user,input={}){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('create_provider_vehicle',{actor_user_id:user.id,command:{
    make:String(input.make||'').trim(),model:String(input.model||'').trim(),
    cargo_configuration:String(input.cargoConfiguration||'').trim(),plate:String(input.plate||'').trim()
  }});
  if(error)throw vehicleError(error);
  return data;
}
