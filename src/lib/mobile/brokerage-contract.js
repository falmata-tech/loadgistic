import {z} from 'zod';
import {createHash} from 'node:crypto';
import {createSessionToken,verifySessionToken} from '../security.js';
import {validateTransportRequest,validateTransportMessage} from '../domain.js';
const intake=z.object({requestId:z.string().uuid(),secret:z.string().regex(/^[a-f0-9]{64}$/),name:z.string(),phone:z.string(),origin:z.string(),destination:z.string()}).strict();
export function nativeBrokerageIntake(value){const parsed=intake.parse(value);return {input:validateTransportRequest(parsed),digest:createHash('sha256').update('transport-chat:'+parsed.secret).digest('hex')};}
const message=z.object({action:z.literal('SEND'),messageId:z.string().uuid(),body:z.string()}).strict();
const end=z.object({action:z.literal('END'),confirm:z.literal(true)}).strict();
export function nativeBrokerageCommand(value){if(end.safeParse(value).success)return end.parse(value);return {action:'SEND',...validateTransportMessage(message.parse(value))};}
export function nativeBrokerageToken(authority,expiresAt){const duration=Math.min(604800,Math.floor((Date.parse(expiresAt)-Date.now())/1000));if(duration<=0)throw Error('FORBIDDEN');return createSessionToken(`native-brokerage:${authority.requestId}:${authority.digest}`,duration);}
export function readNativeBrokerage(header){if(typeof header!=='string'||header.length>2048)return null;const token=header.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1];if(!token)return null;const payload=verifySessionToken(token),match=String(payload?.sub||'').match(/^native-brokerage:([0-9a-f-]{36}):([a-f0-9]{64})$/);return match?{requestId:match[1],digest:match[2],actorId:null}:null;}
export function nativeBrokerageSnapshot(value,requestId){
 if(!value||value.request?.id!==requestId)throw Error('FORBIDDEN');
 const request=value.request;
 return {request:{id:request.id,origin:request.origin,destination:request.destination,status:request.status,assignedName:request.assignedName||null,updatedAt:request.updatedAt,endedAt:request.endedAt||null,expiresAt:request.expiresAt},
 messages:(value.messages||[]).map(item=>({id:item.id,sequence:item.sequence,kind:item.sender_kind==='VISITOR'?'VISITOR':'BROKER',body:item.body,createdAt:item.created_at,name:item.sender_kind==='BROKER'?item.sender_name||'Loadgistic Brokerage':'You'})),hasOlder:value.hasMore===true};
}
