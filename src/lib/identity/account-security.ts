import type {SupabaseClient} from '@supabase/supabase-js';
import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {getManagedCurrentUser} from './supabase';

export async function accountSecurityActor(client:SupabaseClient){
 const {data,error}=await client.auth.getUser();if(error||!data.user)throw new Error('FORBIDDEN');
 const user=await getManagedCurrentUser(client,data.user);
 if(!user?.active||!['TRANSPORTER','DRIVER'].includes(user.role))throw new Error('FORBIDDEN');
 return {user,authUser:data.user};
}
export async function accountDeactivationBlockers(actorId:string):Promise<string[]>{
 const {data,error}=await createSupabaseAdminClient().rpc('account_deactivation_blockers',{actor_user_id:actorId});
 if(error||!Array.isArray(data)||data.some(item=>typeof item!=='string'))throw new Error('ACCOUNT_SECURITY_UNAVAILABLE');return data;
}
export async function deactivateOwnAccount(actorId:string):Promise<void>{
 const {error}=await createSupabaseAdminClient().rpc('deactivate_own_account',{actor_user_id:actorId,confirmation:'DEACTIVATE'});
 if(error)throw new Error(['FORBIDDEN','ACCOUNT_HAS_ACTIVE_WORK','ACCOUNT_REAUTH_REQUIRED'].includes(error.message)?error.message:'ACCOUNT_SECURITY_UNAVAILABLE');
}
