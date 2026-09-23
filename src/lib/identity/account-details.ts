import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {canEditAccountDetails,parseAccountDetails} from '../account-details.js';

export interface AccountDetailsActor {id:string;role:string;active:boolean}
export interface AccountDetailsInput {name:string;phone:string}

export async function updateOwnAccountDetails(actor:AccountDetailsActor,input:unknown):Promise<void>{
  if(!canEditAccountDetails(actor))throw new Error('FORBIDDEN');
  const command:AccountDetailsInput=parseAccountDetails(input);
  const {error}=await createSupabaseAdminClient().rpc('update_own_account_details',{
    actor_user_id:actor.id,command
  });
  if(error)throw new Error(['FORBIDDEN','INVALID_ACCOUNT_DETAILS'].find(code=>error.message===code)||'ACCOUNT_DETAILS_FAILED');
}
