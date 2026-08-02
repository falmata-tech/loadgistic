import { NextResponse } from 'next/server.js';
import { getDb } from '@/lib/db.js';
import { launchReadiness } from '@/lib/launch-readiness.js';
export const runtime='nodejs';
export async function GET(){
  const readiness=launchReadiness();
  const row=getDb().prepare('SELECT COUNT(*) AS users FROM users').get();
  return NextResponse.json({
    ok:readiness.ok,
    service:'loadgistic',
    runtime:readiness.runtime,
    database:'sqlite-local',
    storage:readiness.storageBackend,
    blockers:readiness.blockers,
    warnings:readiness.warnings,
    users:row.users,
    time:new Date().toISOString()
  },{status:readiness.ok?200:503});
}
