import {createHash} from 'node:crypto';
import {z} from 'zod';
import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {MobileError} from './server';
export {phoneLocationCommand} from '../phone-location-command.js';
import {phoneInstallationProof} from '../phone-location-contract.js';
export {phoneInstallationProof} from '../phone-location-contract.js';

export type PhoneInstallationProof=z.infer<typeof phoneInstallationProof>;
const identity={installationId:z.string().uuid(),secret:z.string().regex(/^[a-f0-9]{64}$/)};
export const phoneInstallationCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('REGISTER'),...identity,vehicleId:z.string().uuid().optional(),takeover:z.boolean().default(false)}).strict(),
 z.object({action:z.literal('RELEASE'),...identity,bindingId:z.string().uuid(),revision:z.string().uuid()}).strict(),
]);
export function installationSecretDigest(secret:string){return createHash('sha256').update(secret).digest('hex');}
/** Use only after Supabase has authenticated this exact token. The claim is an
 * attribution key, never a replacement for signature/user verification. */
export function verifiedLocationAuthSession(token:string){try{
 const payload=JSON.parse(Buffer.from(token.split('.')[1]||'','base64url').toString('utf8')) as {session_id?:unknown};
 const value=z.string().uuid().safeParse(payload.session_id);if(value.success)return value.data;
 }catch{/* Invalid or legacy session has no installation binding. */}
 throw new MobileError(401,'SIGN_IN_REQUIRED','Sign in again to connect this phone.');}
export async function phoneLocationRpc(name:'register_phone_location_installation'|'release_phone_location_installation'|'phone_location_workspace'|'revoke_phone_location_auth_session',args:Record<string,unknown>){
 const {data,error}=await createSupabaseAdminClient().rpc(name,args);
 if(error){const code=String(error.message||'');
  if(/PHONE_LOCATION_IN_USE/.test(code))throw new MobileError(409,'PHONE_LOCATION_IN_USE','Another phone is connected to this vehicle. Disconnect it before connecting this phone.');
  if(/PHONE_LOCATION_SUPERSEDED|PHONE_LOCATION_UNAVAILABLE|FORBIDDEN|NOT_FOUND/.test(code))throw new MobileError(403,'PHONE_LOCATION_UNAVAILABLE','This phone is no longer connected to this vehicle. Sign in again and check its location source.');
  if(/INVALID_PHONE_LOCATION/.test(code))throw new MobileError(400,'INVALID_INPUT','Could not confirm this phone. Please try again.');
  throw new MobileError(503,'LOCATION_UNAVAILABLE','Phone location could not connect. Please try again.');
 }
 return data;
}
export const phoneBinding=z.object({installationId:z.string().uuid(),bindingId:z.string().uuid(),revision:z.string().uuid(),vehicleId:z.string().uuid(),actorId:z.string().uuid(),expiresAt:z.string().datetime({offset:true})}).strict();
