import {z} from 'zod';
import {createSupabaseAdminClient} from './supabase-adapter.js';
import {buildEmailMessage} from './email-templates.js';
import {sendManagedEmail} from './email-provider.js';

const knownErrors=['FORBIDDEN','SUBSCRIPTION_ACCESS_REQUIRED','NOT_FOUND','INVALID_DRIVER_CONTACT',
  'DRIVER_ALREADY_IN_FLEET','INVITATION_LIMIT_REACHED','INVITATION_NOT_AVAILABLE','DRIVER_ACCOUNT_CONFLICT'];
async function command(name:string,args:Record<string,unknown>):Promise<unknown>{
  const {data,error}=await createSupabaseAdminClient().rpc(name,args);
  if(error)throw new Error(knownErrors.find(code=>String(error.message).includes(code))||'FLEET_DRIVER_OPERATION_FAILED');
  return data;
}
const ownerInvitation=z.object({id:z.string().uuid(),email:z.string(),driver_name:z.string(),phone:z.string(),
  created_at:z.string(),expires_at:z.string(),email_sent_at:z.string().nullable()});
const identityInvitation=z.object({id:z.string().uuid(),organization_name:z.string(),driver_name:z.string(),
  expires_at:z.string(),can_accept:z.boolean()});
export type FleetInvitation=z.infer<typeof ownerInvitation>;
export type IdentityFleetInvitation=z.infer<typeof identityInvitation>;
export interface DriverContactInput {name:string;phone:string}
export interface InviteDriverInput extends DriverContactInput {email:string}

export async function pendingFleetInvitations(actorId:string):Promise<FleetInvitation[]>{
  return z.array(ownerInvitation).parse(await command('fleet_pending_invitations',{actor_user_id:actorId}));
}
// actorId must come from Supabase auth.getUser()/verified OTP/OAuth, not form fields.
export async function identityFleetInvitations(actorId:string):Promise<IdentityFleetInvitation[]>{
  return z.array(identityInvitation).parse(await command('fleet_identity_invitations',{actor_user_id:actorId}));
}
export async function hasJoinableFleetInvitation(actorId:string):Promise<boolean>{
  return (await identityFleetInvitations(actorId)).some(invitation=>invitation.can_accept);
}
export async function inviteFleetDriver(actorId:string,input:InviteDriverInput):Promise<string>{
  return z.string().uuid().parse(await command('fleet_invite_driver',{actor_user_id:actorId,command:input}));
}
export async function acceptFleetInvitation(actorId:string,invitationId:string):Promise<void>{
  await command('fleet_accept_invitation',{actor_user_id:actorId,invitation_id:invitationId});
}
export async function cancelFleetInvitation(actorId:string,invitationId:string):Promise<void>{
  await command('fleet_cancel_invitation',{actor_user_id:actorId,invitation_id:invitationId});
}
export async function updateFleetDriverContact(actorId:string,driverId:string,input:DriverContactInput):Promise<void>{
  await command('fleet_update_driver_contact',{actor_user_id:actorId,command:{...input,driver_user_id:driverId}});
}
export async function removeFleetDriver(actorId:string,driverId:string):Promise<void>{
  await command('fleet_remove_driver',{actor_user_id:actorId,driver_user_id:driverId});
}
export async function sendFleetInvitation(actorId:string,invitationId:string):Promise<'sent'|'failed'|'recent'>{
  const raw=await command('fleet_claim_invitation_email',{actor_user_id:actorId,invitation_id:invitationId});
  if(!raw)return 'recent';
  const delivery=z.object({id:z.string().uuid(),email:z.string(),organization_name:z.string(),lease:z.string().uuid()}).parse(raw);
  let sent=false;
  try{
    await sendManagedEmail(buildEmailMessage({template:'fleet-driver-invitation',to:delivery.email,
      organizationName:delivery.organization_name,
      url:new URL('/join-fleet',process.env.APP_URL||'http://127.0.0.1:3100').toString()
    }),`loadgistic/fleet-invitation/${delivery.id}/${delivery.lease}`);
    sent=true;
  }catch{/* Delivery failure never discards a persisted invitation or exposes provider details. */}
  await command('fleet_record_invitation_email',{invitation_id:delivery.id,lease_id:delivery.lease,sent});
  return sent?'sent':'failed';
}
