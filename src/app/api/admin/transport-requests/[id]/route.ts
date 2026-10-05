import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {updateTransportRequest,assignTransportRequest} from '@/lib/transport-requests';
import {errorMessage} from '@/lib/errors';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser({allowLimited:true});
  if(!user||(user.role!=='ADMIN'&&!(user.role==='SUPPORT'&&user.can_manage_brokerage)))return NextResponse.json({ok:false,error:'Access denied.'},{status:403});
  try{
    const form=await request.formData(),{id}=await params;
    if(form.get('action')==='assign'||form.get('action')==='claim')await assignTransportRequest(user,id,Number(form.get('version')),String(form.get('assignee')||'')||null,form.get('action')==='claim');
    else await updateTransportRequest(user,id,{status:String(form.get('status')||''),note:String(form.get('note')||''),version:Number(form.get('version'))});
    return NextResponse.json({ok:true});
  }catch(error){return NextResponse.json({ok:false,error:errorMessage(error)},{status:error instanceof Error&&error.message==='TRANSPORT_REQUEST_CHANGED'?409:400});}
}
