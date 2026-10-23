// The repository's offline @playwright/test shim erases fixture types. This is
// the same installed entry point, with its actual browser/fixture contracts.
import {test as base,expect} from 'playwright/test';
import type {Browser,BrowserContext,BrowserContextOptions,Page} from 'playwright-core';
import {localRequestHeaders,localTestIP,scopeLocalRequest,scopeLocalRoute,stripForwardedFor} from './browser-test-headers.mjs';

type LocalDefaults={baseURL?:string;headers?:Record<string,string>};
const defaults=new WeakMap<Browser,LocalDefaults>();

function scopeRouteHandlers(target:BrowserContext|Page,ip:()=>string,baseURL?:string){
 const register=target.route.bind(target),remove=target.unroute.bind(target);
 type Handler=Parameters<Page['route']>[1];
 const handlers=new WeakMap<Handler,Handler>();
 target.route=(url,handler,options)=>{
  let wrapped=handlers.get(handler);
  if(!wrapped){wrapped=(route,request)=>handler(scopeLocalRoute(route,ip,baseURL),request);handlers.set(handler,wrapped);}
  return register(url,wrapped,options);
 };
 target.unroute=(url,handler)=>remove(url,handler?handlers.get(handler)||handler:undefined);
}

async function localContext(browser:Browser,options:BrowserContextOptions,configured:LocalDefaults):Promise<BrowserContext>{
 const headers=options.extraHTTPHeaders??configured.headers;
 const state={ip:localTestIP(headers)};
 const baseURL=options.baseURL??configured.baseURL;
 // Supplying even an empty header map prevents Playwright's defaults hook from
 // adding a test.use x-forwarded-for back onto external requests.
 const context=await browser.newContext({...options,extraHTTPHeaders:stripForwardedFor(headers)});
 try{
  const property=Object.getOwnPropertyDescriptor(context,'request');
  if(!property?.writable)throw Error('LOCAL_TEST_REQUEST_PROPERTY_NOT_WRITABLE');
  context.request=scopeLocalRequest(context.request,()=>state.ip,baseURL);
  const setHeaders=context.setExtraHTTPHeaders.bind(context);
  context.setExtraHTTPHeaders=async next=>{
   state.ip=localTestIP(next);
   await setHeaders(stripForwardedFor(next));
  };
  await context.route('**/*',route=>route.continue({headers:localRequestHeaders(route.request().url(),route.request().headers(),state.ip)}));
  scopeRouteHandlers(context,()=>state.ip,baseURL);
  context.on('page',page=>scopeRouteHandlers(page,()=>state.ip,baseURL));
  return context;
 }catch(error){await context.close();throw error;}
}

export const test=base.extend<{_localBrowserDefaults:void}>({
 browser:async({browser},use)=>{
  const proxy=new Proxy(browser,{get(target,key){
   if(key==='newContext')return (options:BrowserContextOptions={})=>localContext(target,options,defaults.get(proxy)||{});
   const value=Reflect.get(target,key,target);
   return typeof value==='function'?value.bind(target):value;
  }});
  await use(proxy);
 },
 _localBrowserDefaults:[async({browser,baseURL,extraHTTPHeaders},use)=>{
  defaults.set(browser,{baseURL,headers:extraHTTPHeaders});
  try{await use();}finally{defaults.delete(browser);}
 },{auto:true}],
 request:async({playwright,baseURL,extraHTTPHeaders},use)=>{
  const request=await playwright.request.newContext({baseURL,extraHTTPHeaders:stripForwardedFor(extraHTTPHeaders)});
  try{await use(scopeLocalRequest(request,()=>localTestIP(extraHTTPHeaders),baseURL));}finally{await request.dispose();}
 },
});

export {expect};
export type * from 'playwright/test';
