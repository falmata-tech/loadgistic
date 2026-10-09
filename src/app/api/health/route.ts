import { NextResponse } from 'next/server.js';
import { launchReadiness } from '@/lib/launch-readiness.js';
import { createSupabaseAdminClient } from '@/lib/supabase-adapter';
export const runtime='nodejs';
export async function GET(){
  const runtimeReadiness=launchReadiness();
  const productionReadiness=launchReadiness({...process.env,NODE_ENV:'production'});
  try{
    const database=createSupabaseAdminClient();
    const {count,error}=await database.from('profiles').select('*',{head:true,count:'exact'});
    if(error)throw error;
    const contract=await database.from('platform_controls').select('provider_billing_retired,independent_single_truck,chat_visible_read_receipts,chat_assignment_unread,chat_read_assignment_frame,chat_alert_priority,driver_handover_alerts,capacity_contact_names,native_push_outbox').eq('singleton',true).single();
    const required={provider_billing_retired:'provider-access-contract',independent_single_truck:'independent-truck-contract',chat_visible_read_receipts:'chat-read-contract',chat_assignment_unread:'chat-assignment-unread-contract',chat_read_assignment_frame:'chat-assignment-frame-contract',chat_alert_priority:'chat-alert-priority-contract',driver_handover_alerts:'driver-handover-alert-contract',capacity_contact_names:'capacity-contact-name-contract',native_push_outbox:'native-push-contract'};
    const incompatible=Object.entries(required).filter(([field])=>contract.error||contract.data?.[field]!==true).map(([,blocker])=>blocker);
    if(incompatible.length)return NextResponse.json({
      ok:false,readyForPublicProduction:false,service:'loadgistic',database:'supabase-postgres',
      blockers:[...productionReadiness.blockers,...incompatible],warnings:runtimeReadiness.warnings
    },{status:503});
    return NextResponse.json({
      ok:true,readyForPublicProduction:productionReadiness.ok,service:'loadgistic',runtime:runtimeReadiness.runtime,
      database:'supabase-postgres',storage:runtimeReadiness.storageBackend,blockers:productionReadiness.blockers,
      warnings:runtimeReadiness.warnings,users:Number(count||0),time:new Date().toISOString()
    });
  }catch{
    return NextResponse.json({
      ok:false,readyForPublicProduction:false,service:'loadgistic',runtime:runtimeReadiness.runtime,
      database:'supabase-unavailable',
      storage:runtimeReadiness.storageBackend,blockers:[...new Set([...productionReadiness.blockers,'database-unavailable'])],
      warnings:runtimeReadiness.warnings,time:new Date().toISOString()
    },{status:503});
  }
}
