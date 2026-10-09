import 'server-only';
import {createSupabaseAdminClient} from './supabase-adapter.js';
import {handoverAlertInput,handoverAlertSnapshot} from './handover-alerts.js';
import type {HandoverAlertSnapshot} from './handover-alerts.js';
export async function readHandoverAlerts(actorId:string):Promise<HandoverAlertSnapshot>{
 const {data,error}=await createSupabaseAdminClient().rpc('driver_handover_alert_snapshot',{actor_user_id:actorId});
 if(error)throw Error(error.message==='FORBIDDEN'?'FORBIDDEN':'HANDOVER_ALERT_UNAVAILABLE');return handoverAlertSnapshot(data);
}
export async function acknowledgeHandoverAlert(actorId:string,input:unknown):Promise<HandoverAlertSnapshot>{
 const parsed=handoverAlertInput(input);
 const {data,error}=await createSupabaseAdminClient().rpc('acknowledge_driver_handover_alert',{actor_user_id:actorId,target_shipment_id:parsed.id,expected_approved_at:parsed.approvedAt});
 if(error)throw Error(['FORBIDDEN','HANDOVER_ALERT_CHANGED'].includes(error.message)?error.message:'HANDOVER_ALERT_UNAVAILABLE');return handoverAlertSnapshot(data);
}
