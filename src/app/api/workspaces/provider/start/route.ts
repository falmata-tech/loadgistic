import {NextRequest,NextResponse} from 'next/server.js';
import {createSupabaseRouteClient} from '@/lib/supabase/route';
import {getManagedCurrentUser} from '@/lib/identity/supabase';
import {createProviderSignupHandoff,managedProviderSignupEligible,MANAGED_SIGNUP_COOKIE,MANAGED_SIGNUP_MAX_AGE_SECONDS} from '@/lib/provider-signup.js';
import {mutationOriginAllowed} from '@/lib/origin.js';
import {contentPolicyAccepted} from '@/lib/privacy/content-policy.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 const response=new NextResponse(null,{status:303,headers:{Location:'/workspaces','Cache-Control':'no-store'}});
 if(!mutationOriginAllowed(request.headers,request.url))return NextResponse.json({error:'Use this app to continue.'},{status:403});
 if(!(await checkRateLimit(requestKey(request,'workspace-provider-start'),10,600000)).allowed)return NextResponse.json({error:'Please wait and try again.'},{status:429});
 const client=createSupabaseRouteClient(request,response),{data,error}=await client.auth.getUser();
 if(error||!data.user?.email_confirmed_at){response.headers.set('Location','/login');return response;}
 const user=await getManagedCurrentUser(client,data.user);
 if(!user||['ADMIN','SUPPORT'].includes(user.platform_role||user.role)||!await managedProviderSignupEligible(user.id))return response;
 if(!await contentPolicyAccepted(user.id))return response;
 response.cookies.set(MANAGED_SIGNUP_COOKIE,createProviderSignupHandoff(data.user.email),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:MANAGED_SIGNUP_MAX_AGE_SECONDS});
 response.headers.set('Location','/apply?step=details');return response;
}
