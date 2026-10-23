import {z} from 'zod';
import {contentPolicyAccepted,acceptContentPolicy,contentPolicyVersion} from '@/lib/privacy/content-policy.js';
import {mobileVerifiedIdentity,mobileBody,mobileFailure,mobileJson,MobileError} from '@/lib/mobile/server';
export const runtime='nodejs';
export async function GET(request:Request){try{const user=await mobileVerifiedIdentity(request);return mobileJson({accepted:await contentPolicyAccepted(user.id),version:contentPolicyVersion,actorId:user.id});}catch(error){return mobileFailure(error);}}
export async function POST(request:Request){try{const user=await mobileVerifiedIdentity(request);const input=z.object({version:z.literal(contentPolicyVersion),accepted:z.literal(true),actorId:z.literal(user.id)}).strict().safeParse(await mobileBody(request));if(!input.success)throw new MobileError(400,'POLICY_REQUIRED','Read and accept the current terms before sharing content.');await acceptContentPolicy(user.id);return mobileJson({accepted:true,version:contentPolicyVersion,actorId:user.id});}catch(error){return mobileFailure(error);}}
