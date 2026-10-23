import {mobileActor,mobileBody,mobileFailure,mobileJson,MobileError} from '@/lib/mobile/server';
import {phoneInstallationCommand,installationSecretDigest,phoneLocationRpc,phoneBinding,verifiedLocationAuthSession} from '@/lib/mobile/phone-location';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {z} from 'zod';
export const runtime='nodejs';
export async function GET(request:Request){try{
 const actor=await mobileActor(request,true),vehicle=z.string().uuid().safeParse(new URL(request.url).searchParams.get('vehicleId'));
 if(!vehicle.success)throw new MobileError(400,'INVALID_INPUT','Choose a vehicle.');
 const value=await phoneLocationRpc('phone_location_workspace',{actor_user_id:actor.id,target_vehicle_id:vehicle.data});
 const parsed=z.object({installationId:z.string().uuid(),connected:z.boolean(),lastObservedAt:z.string().datetime({offset:true}).nullable(),expiresAt:z.string().datetime({offset:true}),accuracyMeters:z.number().finite().min(0).max(40000).nullable(),speedKph:z.number().finite().min(0).max(300).nullable(),headingDegrees:z.number().finite().min(0).lt(360).nullable()}).strict().nullable().safeParse(value);
 if(!parsed.success)throw new MobileError(503,'LOCATION_UNAVAILABLE','Phone details could not be confirmed.');
 return mobileJson({phone:parsed.data});
 }catch(error){return mobileFailure(error);}}
export async function POST(request:Request){try{
 const parsed=phoneInstallationCommand.safeParse(await mobileBody(request));
 if(!parsed.success)throw new MobileError(400,'INVALID_INPUT','Could not confirm this phone. Please try again.');
 const input=parsed.data;
 const rate=await checkRateLimit(requestKey(request,'phone-location-installation'),60,60000);
 if(!rate.allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait and try again.');
 const identity={target_installation_id:input.installationId,installation_secret_digest:installationSecretDigest(input.secret)};
 if(input.action==='RELEASE'){
  // Exact device-secret and binding-revision proof permits offline logout retry;
  // it grants no read, enrollment or account authority.
  await phoneLocationRpc('release_phone_location_installation',{...identity,target_binding_id:input.bindingId,expected_revision:input.revision});
  return mobileJson({ok:true});
 }
 const actor=await mobileActor(request,true);
 const sessionId=verifiedLocationAuthSession(request.headers.get('authorization')?.replace(/^Bearer /,'')||'');
 const value=await phoneLocationRpc('register_phone_location_installation',{...identity,actor_user_id:actor.id,target_vehicle_id:input.vehicleId||null,allow_takeover:input.takeover,authenticated_session_id:sessionId});
 const binding=phoneBinding.safeParse(value);
 if(!binding.success)throw new MobileError(503,'LOCATION_UNAVAILABLE','Phone location could not be confirmed.');
 return mobileJson(binding.data);
 }catch(error){return mobileFailure(error);}}
