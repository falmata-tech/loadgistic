import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {updateOwnAccountDetails} from '@/lib/identity/account-details';
import {errorMessage} from '@/lib/errors';
import {redirectWith} from '@/lib/redirects';

export async function POST(request:NextRequest){
  const nativeForm=/^(application\/x-www-form-urlencoded|multipart\/form-data)(;|$)/i.test(request.headers.get('content-type')||'');
  function failure(message:string,status:number){
    return nativeForm?redirectWith(request,'/app/more','error',message):NextResponse.json({ok:false,error:message},{status});
  }
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return failure('Please log in again to save your account details.',401);
  let input:unknown;
  try{
    if(nativeForm){
      const form=await request.formData();
      const keys=[...form.keys()];
      if(new Set(keys).size!==keys.length)throw new Error('INVALID_ACCOUNT_DETAILS');
      input=Object.fromEntries(form.entries());
    }else input=await request.json();
  }catch{
    return failure(errorMessage(new Error('INVALID_ACCOUNT_DETAILS')),400);
  }
  try{
    await updateOwnAccountDetails(user,input);
    return nativeForm?redirectWith(request,'/app/more','success','Account details saved.'):NextResponse.json({ok:true});
  }catch(error){
    const code=error instanceof Error?error.message:'';
    return failure(errorMessage(error),code==='FORBIDDEN'?403:code==='INVALID_ACCOUNT_DETAILS'?400:500);
  }
}
