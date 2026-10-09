// Shared phone/server routing policy. Keep this module free of server schemas
// and dependencies so a notification cannot prevent the native app from starting.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields=new Set(['app','eventId','kind','sourceId','event']);
const events=new Set(['MESSAGE','ASSIGNED','JOINED','ENDED','RESOLVED','APPROVED']);
export function nativePushDestination(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const keys=Object.keys(value);
 if(keys.length!==fields.size||keys.some(key=>!fields.has(key)))return null;
 if(value.app!=='loadgistic'||typeof value.eventId!=='string'||!uuid.test(value.eventId)
  ||typeof value.sourceId!=='string'||!uuid.test(value.sourceId)||!events.has(value.event))return null;
 if(value.kind==='HANDOVER')return value.event==='APPROVED'?{pathname:'/shipment-detail',params:{id:value.sourceId}}:null;
 if(value.event==='APPROVED')return null;
 if(value.kind==='SUPPORT')return {pathname:'/support-chat',params:{id:value.sourceId}};
 return value.kind==='BROKERAGE'?{pathname:'/arrange-transport'}:null;
}
