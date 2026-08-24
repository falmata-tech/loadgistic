import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server.js';
import { getSupabasePublicConfig } from './config';

export function createSupabaseRouteClient(request:NextRequest,response:NextResponse){
  const {url,publishableKey}=getSupabasePublicConfig();
  return createServerClient(url,publishableKey,{
    auth:{
      flowType:'pkce',
      experimental:{appendPkceFlowIdToRedirects:true}
    },
    cookies:{
      getAll(){
        return request.cookies.getAll();
      },
      setAll(cookiesToSet:Array<{name:string;value:string;options:CookieOptions}>){
        for(const {name,value,options} of cookiesToSet){
          request.cookies.set(name,value);
          response.cookies.set(name,value,options);
        }
      }
    }
  });
}
