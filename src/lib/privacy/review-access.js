import {createSupabaseAdminClient} from '../supabase-adapter.js';
export async function reviewAccountAllowed(actorId){
 const {data,error}=await createSupabaseAdminClient().rpc('native_review_account_allowed',{actor_user_id:actorId});
 if(error||typeof data!=='boolean')throw Error('REVIEW_SCOPE_UNAVAILABLE');return data;
}
export async function reviewVisitorDigest(actorId,scope){
 const {data,error}=await createSupabaseAdminClient().rpc('native_review_visitor_digest',{actor_user_id:actorId,requested_scope:scope});
 if(error)throw Error('REVIEW_SCOPE_UNAVAILABLE');return typeof data==='string'&&/^[a-f0-9]{64}$/.test(data)?data:null;
}
