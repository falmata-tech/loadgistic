// Fixed Expo endpoints; no client-supplied URL, private message or provider error log.
export function expoPushProvider({fetcher=fetch,accessToken}={}){
 const post=async(path,body)=>{
  const response=await fetcher('https://exp.host/--/api/v2/push/'+path,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',...(accessToken?{Authorization:'Bearer '+accessToken}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  if(!response.ok){await response.body?.cancel();throw Error('PUSH_PROVIDER_UNAVAILABLE');}
  const reader=response.body?.getReader();if(!reader)throw Error('PUSH_PROVIDER_UNAVAILABLE');const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw Error('PUSH_PROVIDER_UNAVAILABLE');}chunks.push(value);}const joined=new Uint8Array(size);let offset=0;for(const value of chunks){joined.set(value,offset);offset+=value.byteLength;}return JSON.parse(new TextDecoder().decode(joined));}
  finally{reader.releaseLock();}
 };
 return {async send(messages){if(!Array.isArray(messages)||messages.length>40)throw Error('INVALID_PUSH_BATCH');const value=await post('send',messages);if(!Array.isArray(value.data)||value.data.length!==messages.length)throw Error('PUSH_PROVIDER_UNAVAILABLE');return value.data;},
  async receipts(ids){if(!Array.isArray(ids)||ids.length>40||ids.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(id)))throw Error('INVALID_PUSH_BATCH');const value=await post('getReceipts',{ids});if(!value.data||typeof value.data!=='object'||Array.isArray(value.data))throw Error('PUSH_PROVIDER_UNAVAILABLE');return value.data;}};
}
