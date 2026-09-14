import {createSupabaseAdminClient} from './supabase-adapter.js';

export async function prepareAutomaticFeaturedDays(){
  const {data,error}=await createSupabaseAdminClient().rpc('generate_managed_featured_days');
  if(error)throw new Error('FEATURED_AUTOMATION_FAILED',{cause:error});
  return {created:Number(data?.created)||0,skipped:Number(data?.skipped)||0,empty:Number(data?.empty)||0};
}
