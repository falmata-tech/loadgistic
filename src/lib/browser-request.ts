/** Bound UI waiting, including body reads. Does not retry a possibly committed write. */
export async function browserRequest<T=Record<string,unknown>>(url:string,init:RequestInit={},timeoutMs=15000):Promise<{response:Response;data:T}>{
 const controller=new AbortController();
 let timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('REQUEST_TIMEOUT'));},timeoutMs);});
 try{
  return await Promise.race([(async()=>{const response=await fetch(url,{...init,signal:controller.signal});const data=await response.json() as T;return {response,data};})(),timeout]);
 }finally{clearTimeout(timer);}
}
