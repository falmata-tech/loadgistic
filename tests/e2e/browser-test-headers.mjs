const localHosts=new Set(['localhost','127.0.0.1']);
const localPorts=new Set(['3100','8084','55321']);
const requestMethods=new Set(['get','post','put','patch','delete','head','fetch']);
const routeMethods=new Set(['continue','fetch','fallback']);
const transportReasons=new Map([
 ['ECONNRESET','ECONNRESET'],['ECONNREFUSED','ECONNREFUSED'],['EPIPE','EPIPE'],
 ['ENOTFOUND','ENOTFOUND'],['EAI_AGAIN','EAI_AGAIN'],['ENETUNREACH','ENETUNREACH'],['EHOSTUNREACH','EHOSTUNREACH'],
 ['ETIMEDOUT','TIMEOUT'],['TimeoutError','TIMEOUT'],['ABORT_ERR','ABORTED'],['AbortError','ABORTED']
]);

function safeRequestFailure(method,error) {
 let reason='UNKNOWN';
 try{
  if(error&&typeof error==='object'){
   reason=transportReasons.get(error.code)||transportReasons.get(error.name)||'UNKNOWN';
   if(reason==='UNKNOWN'&&typeof error.message==='string'){
    // Playwright appends headers and cookies after the first diagnostic line.
    const firstLine=error.message.split('\n',1)[0];
    const code=firstLine.match(/\b(ECONNRESET|ECONNREFUSED|EPIPE|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ETIMEDOUT)\b/)?.[1];
    reason=transportReasons.get(code)||(/\bTimeout(?:Error|\s+\d+\s*ms\s+exceeded)\b/i.test(firstLine)?'TIMEOUT':'UNKNOWN');
   }
  }
 }catch{reason='UNKNOWN';}
 return new Error(`BROWSER_API_REQUEST_${method.toUpperCase()}_FAILED_${reason}`);
}
export const defaultLocalTestIP='127.0.0.240';

/** @param {Record<string,string>} [headers] */
export function stripForwardedFor(headers={}) {
 return Object.fromEntries(Object.entries(headers).filter(([name])=>name.toLowerCase()!=='x-forwarded-for'));
}

/** @param {Record<string,string>} [headers] @param {string} [fallback] */
export function localTestIP(headers={},fallback=defaultLocalTestIP) {
 return Object.entries(headers).find(([name])=>name.toLowerCase()==='x-forwarded-for')?.[1]||fallback;
}

/** @param {string|{url:()=>string}} value @param {string} [baseURL] */
export function isLocalTestURL(value,baseURL) {
 try{
  const url=new URL(typeof value==='string'?value:value.url(),baseURL);
  return ['http:','https:'].includes(url.protocol)&&localHosts.has(url.hostname)&&localPorts.has(url.port);
 }catch{return false;}
}

/** @param {string|{url:()=>string}} value @param {Record<string,string>} [headers] @param {string} [ip] @param {string} [baseURL] */
export function localRequestHeaders(value,headers={},ip=defaultLocalTestIP,baseURL) {
 const clean=stripForwardedFor(headers);
 return isLocalTestURL(value,baseURL)?{...clean,'x-forwarded-for':localTestIP(headers,ip)}:clean;
}

/**
 * Keep the original request context and its cookie/storage ownership. Only call
 * headers change; transport failures expose no original request/error details.
 * Every other method stays bound to the original receiver.
 * @template {object} T
 * @param {T} request
 * @param {()=>string} ip
 * @param {string} [baseURL]
 * @returns {T}
 */
export function scopeLocalRequest(request,ip,baseURL) {
 return new Proxy(request,{get(target,key){
  const value=Reflect.get(target,key,target);
  if(typeof value!=='function')return value;
  if(requestMethods.has(String(key)))return async(url,options={})=>{
   try{return await value.call(target,url,{...options,headers:localRequestHeaders(url,options.headers,ip(),baseURL)});}
   catch(error){throw safeRequestFailure(String(key),error);}
  };
  return value.bind(target);
 }});
}

/**
 * Test routes can bypass the context's final header handler. Keep their real
 * receiver and mock response unchanged, including fetch URL/body overrides.
 * @template {object} T
 * @param {T} route
 * @param {()=>string} ip
 * @param {string} [baseURL]
 * @returns {T}
 */
export function scopeLocalRoute(route,ip,baseURL) {
 return new Proxy(route,{get(target,key){
  const value=Reflect.get(target,key,target);
  if(typeof value!=='function')return value;
  if(routeMethods.has(String(key)))return (options={})=>{
   const request=target.request();
   const headers=options.headers??stripForwardedFor(request.headers());
   return value.call(target,{...options,headers:localRequestHeaders(options.url??request.url(),headers,ip(),baseURL)});
  };
  return value.bind(target);
 }});
}
