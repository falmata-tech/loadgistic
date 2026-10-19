import {z} from 'zod';
import {createSupabaseAdminClient} from './supabase-adapter.js';
import {providerWorkspaceCapabilities} from './provider-workspace.js';
import type {ManagedCurrentUser} from './identity/supabase';

const input=z.object({drivesTruck:z.boolean()}).strict();
export async function setProviderDrivingMode(actor:ManagedCurrentUser,value:unknown):Promise<void>{
  if(!providerWorkspaceCapabilities(actor).ownsProviderAccount)throw new Error('FORBIDDEN');
  const parsed=input.safeParse(value);
  if(!parsed.success)throw new Error('INVALID_DRIVING_MODE');
  const {data,error}=await createSupabaseAdminClient().rpc('set_provider_driving_mode',{
    actor_user_id:actor.id,requested_drives_truck:parsed.data.drivesTruck
  });
  if(error||data!==true)throw new Error(['FORBIDDEN','INVALID_DRIVING_MODE','DRIVER_ASSIGNED'].find(code=>error?.message===code)||'DRIVING_MODE_UPDATE_FAILED');
}
