import { NextResponse } from 'next/server.js';
import { launchReadiness } from '@/lib/launch-readiness.js';
import { createSupabaseAdminClient } from '@/lib/supabase-adapter';
export const runtime='nodejs';
export async function GET(){
  const runtimeReadiness=launchReadiness();
  const productionReadiness=launchReadiness({...process.env,NODE_ENV:'production'});
  try{
    const {count,error}=await createSupabaseAdminClient().from('profiles').select('*',{head:true,count:'exact'});
    if(error)throw error;
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
