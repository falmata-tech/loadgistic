import { NextResponse } from 'next/server.js';
import { getDb } from '@/lib/db.js';
import { launchReadiness } from '@/lib/launch-readiness.js';
export const runtime='nodejs';
export async function GET(){
  const runtimeReadiness=launchReadiness();
  const productionReadiness=launchReadiness({...process.env,NODE_ENV:'production'});
  const row=getDb().prepare('SELECT COUNT(*) AS users FROM users').get();
  return NextResponse.json({
    ok:true,
    readyForPublicProduction:productionReadiness.ok,
    service:'loadgistic',
    runtime:runtimeReadiness.runtime,
    database:'sqlite-local',
    storage:runtimeReadiness.storageBackend,
    blockers:productionReadiness.blockers,
    warnings:runtimeReadiness.warnings,
    users:row.users,
    time:new Date().toISOString()
  });
}
