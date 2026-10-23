import {z} from 'zod';
import {businessActor,businessJson,businessLimit} from '@/lib/business-workspaces/http';
import {directoryIdentity,BusinessDirectoryError} from '@/lib/business-directory/domain.js';
import {supabaseBusinessDirectoryPort} from '@/lib/business-directory/supabase';
import {directoryFailure} from '@/lib/business-directory/http';
import {readMobileMultipart} from '@/lib/mobile/file-contract.js';
import {submitSupabaseVerification} from '@/lib/verification/supabase.js';
export const runtime='nodejs';
type Context={params:Promise<{workspaceId:string}>};
const calendarDay=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const day=new Date(value+'T00:00:00Z');return Number.isFinite(day.valueOf())&&day.toISOString().slice(0,10)===value;});
const command=z.object({verificationType:z.enum(['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS']),documentName:z.string().trim().min(1).max(150),expiresOn:calendarDay.or(z.literal('')).default('')}).strict();
export async function GET(request:Request,context:Context){
 try{const actorId=await businessActor(request),workspaceId=directoryIdentity((await context.params).workspaceId);await businessLimit(actorId,'business-documents',120);return businessJson(await supabaseBusinessDirectoryPort().documents(actorId,workspaceId));}
 catch(error){return directoryFailure(error);}
}
export async function POST(request:Request,context:Context){
 try{
  const actorId=await businessActor(request),workspaceId=directoryIdentity((await context.params).workspaceId);await businessLimit(actorId,'business-document-submit',20);
  const current=await supabaseBusinessDirectoryPort().documents(actorId,workspaceId);
  if(!current.canManage)throw new BusinessDirectoryError('FORBIDDEN');
  const upload=await readMobileMultipart(request),input=command.safeParse(upload.command);
  if(!input.success)throw new BusinessDirectoryError('INVALID_BUSINESS_INPUT');
  if(!current.subjects.some(subject=>subject.allowedTypes.includes(input.data.verificationType)))throw new BusinessDirectoryError('VERIFICATION_ALREADY_SUBMITTED');
  const id=await submitSupabaseVerification({id:actorId},{subjectType:'BUSINESS_WORKSPACE',subjectId:workspaceId,...input.data},upload.file);
  return businessJson({ok:true,id});
 }catch(error){return directoryFailure(error);}
}
