// Notifications only: never intercept requests or cache private app/API responses.
self.addEventListener('notificationclick',event=>{
 event.notification.close();const path=event.notification.data?.href;
 const id='[0-9a-f-]{36}';
 const allowed=typeof path==='string'&&new RegExp('^(?:/support(?:\\?view=WAITING|/'+id+')?|/brokerage(?:\\?queue=UNASSIGNED|/'+id+')?|/app/support\\?conversation='+id+'|/app/provider-shipments/'+id+'|/about#transport-chat|/arrange-transport|/support-chat\\?id='+id+'|/shipment-detail\\?id='+id+')$','i').test(path);
 if(!allowed)return;
 event.waitUntil((async()=>{const destination=new URL(path,self.location.origin).href,windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const client=windows.find(item=>item.url===destination)||windows.find(item=>new URL(item.url).origin===self.location.origin);
  if(client){if(client.url!==destination)await client.navigate(destination);await client.focus();client.postMessage({type:'loadgistic-open-transport',href:path});}
  else await self.clients.openWindow(destination);
 })());
});
