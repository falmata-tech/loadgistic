import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {contentPolicyAccepted,acceptContentPolicy,contentPolicyVersion} from '@/lib/privacy/content-policy.js';
import {mobileBody,mobileFailure,mobileJson,MobileError} from '@/lib/mobile/server';
export const runtime='nodejs';
async function actor(){const user=await getCurrentUser({allowLimited:true});if(!user||!['TRANSPORTER','DRIVER'].includes(user.role))throw new MobileError(403,'FORBIDDEN','Sign in to your transporter account.');return user;}
export async function GET(){try{const user=await actor();return mobileJson({accepted:await contentPolicyAccepted(user.id),version:contentPolicyVersion,actorId:user.id});}catch(error){return mobileFailure(error);}}
export async function POST(request:Request){try{const user=await actor();const input=z.object({version:z.literal(contentPolicyVersion),accepted:z.literal(true),actorId:z.literal(user.id)}).strict().safeParse(await mobileBody(request));if(!input.success)throw new MobileError(400,'POLICY_REQUIRED','Read and accept the current terms before sharing content.');await acceptContentPolicy(user.id);return mobileJson({accepted:true,version:contentPolicyVersion,actorId:user.id});}catch(error){return mobileFailure(error);}}
