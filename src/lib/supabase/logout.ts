import {createServerClient,type CookieOptions} from '@supabase/ssr';
import type {NextRequest,NextResponse} from 'next/server.js';
import {getSupabasePublicConfig} from './config';

const LOGOUT_DEADLINE_MS=4000;

function projectAuthCookie(name:string,storageKey:string){
  if(name===storageKey||name.startsWith(`${storageKey}.`)&&/^\d+$/.test(name.slice(storageKey.length+1)))return true;
  const suffix=name.slice(storageKey.length);
  return name.startsWith(storageKey)&&/^-(?:user|code-verifier|flows-code-verifier|flow-[A-Za-z0-9_-]+-code-verifier)(?:\.\d+)?$/.test(suffix);
}

// Logout must remove this browser's credentials even when managed Auth is
// unavailable. A timeout never proves that remote refresh tokens were revoked.
export async function signOutSupabaseRoute(request:NextRequest,response:NextResponse,{timeoutMs=LOGOUT_DEADLINE_MS}:{timeoutMs?:number}={}){
  const {url,publishableKey}=getSupabasePublicConfig();
  const storageKey=`sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  const controller=new AbortController();
  let writesAllowed=true,timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const deadline=new Promise<null>(resolve=>{
      timer=setTimeout(()=>{controller.abort();resolve(null);},Math.max(1,Math.min(LOGOUT_DEADLINE_MS,timeoutMs)));
    });
    const client=createServerClient(url,publishableKey,{
      auth:{flowType:'pkce'},
      global:{fetch:(input:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1])=>fetch(input,{...init,signal:init?.signal?AbortSignal.any([controller.signal,init.signal]):controller.signal})},
      cookies:{
        getAll:()=>request.cookies.getAll(),
        setAll(cookiesToSet:Array<{name:string;value:string;options:CookieOptions}>){
          if(!writesAllowed)return;
          for(const {name,value,options}of cookiesToSet){request.cookies.set(name,value);response.cookies.set(name,value,options);}
        }
      }
    });
    // Preserve the existing global scope; no token, session, or service key is
    // decoded or retained outside Supabase's managed client.
    const result=await Promise.race([client.auth.signOut(),deadline]);
    return {remoteRevocationConfirmed:result!==null&&!result.error};
  }catch{
    return {remoteRevocationConfirmed:false};
  }finally{
    writesAllowed=false;
    if(timer)clearTimeout(timer);
    controller.abort();
    const names=new Set([storageKey,...request.cookies.getAll().map(cookie=>cookie.name),...response.cookies.getAll().map(cookie=>cookie.name)]);
    for(const name of names)if(projectAuthCookie(name,storageKey)){
      request.cookies.delete(name);
      response.cookies.set(name,'',{path:'/',sameSite:'lax',maxAge:0,expires:new Date(0)});
    }
  }
}
