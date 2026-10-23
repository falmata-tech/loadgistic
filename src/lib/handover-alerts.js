// Exact whitelist shared by web/native. Updates contain no contact/route/proof data.
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const stamp=value=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));
export function handoverAlertInput(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==2||!uuid(value.id)||!stamp(value.approvedAt))throw Error('INVALID_HANDOVER_ALERT');
 return {id:value.id,approvedAt:value.approvedAt};
}
export function handoverAlertSnapshot(value){
 if(!value||!Number.isSafeInteger(value.unreadCount)||value.unreadCount<0||!Array.isArray(value.items)||value.items.length>40)throw Error('HANDOVER_ALERT_UNAVAILABLE');
 const ids=new Set();const items=value.items.map(item=>{
  if(!item||!uuid(item.id)||!stamp(item.approvedAt)||!['OWNER','STAFF'].includes(item.approvalKind)||typeof item.unread!=='boolean'||ids.has(item.id))throw Error('HANDOVER_ALERT_UNAVAILABLE');
  ids.add(item.id);return {id:item.id,approvedAt:item.approvedAt,approvalKind:item.approvalKind,unread:item.unread};
 });return {unreadCount:value.unreadCount,items};
}
export function handoverAlertCopy(item){return item.approvalKind==='OWNER'?'Unloading approved · Tracking completed':'Team approved unloading · Tracking completed';}
export function handoverAlertHref(item){if(!uuid(item.id))throw Error('INVALID_HANDOVER_ALERT');return '/app/provider-shipments/'+item.id;}
export function createHandoverAlertTracker(){
 let initialized=false,watermark=0;const delivered=new Set();
 return {reset(){initialized=false;watermark=0;delivered.clear();},next(snapshot){
  const changes=snapshot.items.filter(item=>initialized&&item.unread&&Date.parse(item.approvedAt)>watermark&&!delivered.has(item.id+':'+item.approvedAt));
  for(const item of snapshot.items){watermark=Math.max(watermark,Date.parse(item.approvedAt));delivered.add(item.id+':'+item.approvedAt);if(delivered.size>200)delivered.delete(delivered.values().next().value);}
  initialized=true;return changes;
 }};
}
