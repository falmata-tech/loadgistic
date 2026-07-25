import { NextResponse } from 'next/server.js';
import { getDb } from '@/lib/db.js';
export const runtime='nodejs';
export async function GET(){const row=getDb().prepare('SELECT COUNT(*) AS users FROM users').get();return NextResponse.json({ok:true,service:'loadgistic',database:'sqlite-local',users:row.users,time:new Date().toISOString()});}
