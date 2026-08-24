import { NextResponse } from 'next/server.js';
import { launchReadiness } from '@/lib/launch-readiness.js';
import { createSupabaseAdminClient } from '@/lib/supabase-adapter';
export const runtime='nodejs';
export async function GET(){
  const runtimeReadiness=launchReadiness();
  const productionReadiness=launchReadiness({...process.env,NODE_ENV:'production'});
  let database='sqlite-local';
  let users=0;
  try{
    if(runtimeReadiness.dataBackend==='supabase'){
      const {count,error}=await createSupabaseAdminClient().from('profiles').select('*',{head:true,count:'exact'});
      if(error)throw error;
      database='supabase-postgres';
      users=Number(count||0);
    }else{
      const {getDb}=await import('@/lib/db.js');
      users=Number(getDb().prepare('SELECT COUNT(*) AS users FROM users').get().users||0);
    }
  }catch{
    return NextResponse.json({
      ok:false,readyForPublicProduction:false,service:'loadgistic',runtime:runtimeReadiness.runtime,
      database:runtimeReadiness.dataBackend==='supabase'?'supabase-unavailable':'sqlite-unavailable',
      storage:runtimeReadiness.storageBackend,blockers:[...new Set([...productionReadiness.blockers,'database-unavailable'])],
      warnings:runtimeReadiness.warnings,time:new Date().toISOString()
    },{status:503});
  }
  return NextResponse.json({
    ok:true,
    readyForPublicProduction:productionReadiness.ok,
    service:'loadgistic',
    runtime:runtimeReadiness.runtime,
    database,
    storage:runtimeReadiness.storageBackend,
    blockers:productionReadiness.blockers,
    warnings:runtimeReadiness.warnings,
    users,
    time:new Date().toISOString()
  });
}
