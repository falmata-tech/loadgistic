// Browser-only adapter. No push subscription, credentials, offline cache or private transcript.
export function safeNotificationPath(value){
 if(typeof value!=='string'||value.length>160)return null;
 const id='[0-9a-f-]{36}';
 return new RegExp('^(?:/support(?:\\?view=WAITING|/'+id+')?|/brokerage(?:\\?queue=UNASSIGNED|/'+id+')?|/app/support\\?conversation='+id+'|/app/provider-shipments/'+id+'|/about#transport-chat|/arrange-transport|/support-chat\\?id='+id+'|/shipment-detail\\?id='+id+')$','i').test(value)?value:null;
}
export function createBrowserAlertDelivery(identity){
 let enabled=false,disposed=false,registration=null,key='',status='OFF';
 const supported=()=>typeof window!=='undefined'&&window.isSecureContext&&'Notification'in window&&'serviceWorker'in navigator&&!!globalThis.crypto?.subtle;
 const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
 const saved=value=>{try{if(value===undefined)return localStorage.getItem(key)==='1';localStorage.setItem(key,value?'1':'0');}catch{return false;}};
 async function worker(){
  registration??=await navigator.serviceWorker.register('/loadgistic-alerts-sw.js',{scope:'/_loadgistic-alerts/'});
  if(!registration.active)await new Promise((resolve,reject)=>{const candidate=registration.installing||registration.waiting;if(!candidate)return reject(Error('WORKER_UNAVAILABLE'));
   const timer=setTimeout(()=>{candidate.removeEventListener('statechange',changed);reject(Error('WORKER_UNAVAILABLE'));},8000);
   const changed=()=>{if(candidate.state==='activated'){clearTimeout(timer);candidate.removeEventListener('statechange',changed);resolve();}};candidate.addEventListener('statechange',changed);changed();});
  return registration;
 }
 async function clear(){try{const current=registration||await navigator.serviceWorker.getRegistration('/_loadgistic-alerts/');for(const item of await current?.getNotifications()||[])if(item.tag.startsWith(key+':'))item.close();}catch{/* Permission/worker failure cannot affect chat. */}}
 return {
  async prepare(){if(!supported()){status='UNSUPPORTED';return status;}key='loadgistic-alert:'+await hash(identity);if(disposed)return status;
   enabled=Notification.permission==='granted'&&saved();status=Notification.permission==='denied'?'DENIED':enabled?'ON':'OFF';return status;},
  async toggle(){if(!supported())return 'UNSUPPORTED';if(!key)await this.prepare();if(disposed)return status;
   if(enabled){enabled=false;saved(false);await clear();return status='OFF';}
   try{const permission=await Notification.requestPermission();if(permission!=='granted')return status=permission==='denied'?'DENIED':'OFF';
    await worker();if(disposed)return status;enabled=true;saved(true);return status='ON';
   }catch{enabled=false;return status='UNAVAILABLE';}},
  enabled(){return enabled&&supported()&&Notification.permission==='granted'&&!disposed;},
  status(){if(!supported())return 'UNSUPPORTED';if(Notification.permission!=='granted'){enabled=false;return status=Notification.permission==='denied'?'DENIED':'OFF';}return status;},
  async reconcile(category,hrefs){if(!this.enabled()||!['chat','handover'].includes(category))return;try{const current=registration||await navigator.serviceWorker.getRegistration('/_loadgistic-alerts/');for(const item of await current?.getNotifications()||[])if(item.tag.startsWith(key+':')&&item.data?.category===category&&!hrefs.includes(item.data?.href))item.close();}catch{/* Stale-delivery cleanup is independent of unread authority. */}},
  async deliver({eventKey,body,href}){
   if(!this.enabled())return false;const path=safeNotificationPath(href);if(!path||typeof eventKey!=='string'||typeof body!=='string')return false;
   try{const tag=key+':'+await hash(eventKey),claimKey=tag+':sent';
    const send=async()=>{if(!this.enabled())return false;try{if(localStorage.getItem(claimKey))return false;}catch{/* Notification tags still coalesce without storage. */}
     const current=await worker();if(!this.enabled())return false;
     await current.showNotification('Loadgistic',{body,tag,data:{href:path,category:eventKey.startsWith('handover:')?'handover':'chat'},silent:true});
     try{localStorage.setItem(claimKey,String(Date.now()));const stale=[];for(let i=0;i<localStorage.length;i++){const name=localStorage.key(i);if(name?.startsWith(key+':')&&name.endsWith(':sent'))stale.push(name);}
      stale.sort((a,b)=>Number(localStorage.getItem(b))-Number(localStorage.getItem(a)));for(const name of stale.slice(200))localStorage.removeItem(name);
     }catch{/* Delivery succeeded; local dedup storage is optional. */}return true;};
    return navigator.locks?await navigator.locks.request(tag,send):await send();
   }catch{return false;}
  },
  async dispose(){disposed=true;enabled=false;await clear();}
 };
}
