import {createSupabaseAdminClient} from './supabase-adapter.js';
import {hasPlatformPermission} from './platform-admin.js';

export async function prepareAutomaticFeaturedDays(){
  const {data,error}=await createSupabaseAdminClient().rpc('generate_managed_featured_days');
  if(error||data?.ok===false)throw new Error('FEATURED_AUTOMATION_FAILED',{cause:error});
  return {created:Number(data?.created)||0,skipped:Number(data?.skipped)||0,empty:Number(data?.empty)||0,busy:Boolean(data?.busy)};
}


export async function getFeaturedOverview(user){
  if(!hasPlatformPermission(user,'FEATURED'))throw new Error('FORBIDDEN');
  const {data,error}=await createSupabaseAdminClient().rpc('managed_featured_overview',{actor_user_id:user.id});
  if(error)throw new Error('FEATURED_OVERVIEW_UNAVAILABLE',{cause:error});
  return data;
}

export async function prepareFeaturedDaysForUser(user){
 if(!hasPlatformPermission(user,'FEATURED'))throw new Error('FORBIDDEN');
 const {data,error}=await createSupabaseAdminClient().rpc('prepare_managed_featured_days',{actor_user_id:user.id});
 if(error||data?.ok===false)throw new Error('FEATURED_AUTOMATION_FAILED',{cause:error});
 return {created:Number(data?.created)||0,skipped:Number(data?.skipped)||0,empty:Number(data?.empty)||0,busy:Boolean(data?.busy)};
}
