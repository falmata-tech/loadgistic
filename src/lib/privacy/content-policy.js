import {createSupabaseAdminClient} from '../supabase-adapter.js';
export const contentPolicyVersion='2026-10-09';
export async function contentPolicyAccepted(actorId){
 const {data,error}=await createSupabaseAdminClient().rpc('content_policy_accepted',{actor_user_id:actorId});
 if(error||typeof data!=='boolean')throw Error('POLICY_UNAVAILABLE');return data;
}
export async function acceptContentPolicy(actorId){
 const {error}=await createSupabaseAdminClient().rpc('accept_content_policy',{actor_user_id:actorId,policy_version:contentPolicyVersion});
 if(error)throw Error('POLICY_UNAVAILABLE');
}
export async function requireContentPolicy(actorId){if(!await contentPolicyAccepted(actorId))throw Error('POLICY_REQUIRED');}
