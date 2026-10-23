import {z} from 'zod';
import {nativePushDestination} from './native-push-destination.js';
export {nativePushDestination} from './native-push-destination.js';
const uuid=z.string().uuid(),secret=z.string().regex(/^[a-f0-9]{64}$/);
export const nativePushCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('REGISTER'),installationId:uuid,secret,token:z.string().regex(/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{10,160}\]$/),locale:z.enum(['en','am','om','so','ti'])}).strict(),
 z.object({action:z.literal('REMOVE'),installationId:uuid,secret,scope:z.enum(['MEMBER','GUEST','ALL'])}).strict(),
]);
export function nativePushMessage(row,translate=message=>message){
 const data={app:'loadgistic',eventId:row.id,kind:row.kind,sourceId:row.sourceId,event:row.event};
 if(!nativePushDestination(data)||!nativePushCommand.options[0].shape.token.safeParse(row.token).success)throw Error('INVALID_PUSH_CONTEXT');
 const key={MESSAGE:'New unread message',ASSIGNED:'A team member is assigned',JOINED:'A team member joined your chat',ENDED:'Chat ended · follow-up is still available',RESOLVED:'Your request was resolved',APPROVED:'Unloading approved · Tracking completed'}[row.event];
 return {to:row.token,title:'Loadgistic',body:translate(key),data,channelId:'loadgistic-updates',sound:'default',priority:'high',ttl:3600,tag:row.id,collapseId:row.id};
}
const failures=new Set(['DeviceNotRegistered','InvalidCredentials','MessageTooBig','MessageRateExceeded']);
export function nativePushOutcome(value,receipt=false){
 if(!value)return {code:receipt?'NO_RECEIPT':'PROVIDER_REJECTED'};
 if(value.status==='ok'){
  if(receipt)return {code:'DELIVERED'};
  return typeof value.id==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(value.id)?{code:'ACCEPTED',ticketId:value.id}:{code:'PROVIDER_REJECTED'};
 }
 return {code:failures.has(value.details?.error)?value.details.error:'PROVIDER_REJECTED'};
}
