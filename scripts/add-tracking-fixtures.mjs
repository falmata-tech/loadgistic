import { closeDb, getDb } from '../src/lib/db.js';
import { addTrackingScenarios } from './lib/tracking-fixtures.mjs';

if(process.env.NODE_ENV==='production')throw new Error('Tracking fixtures are development-only and cannot run in Production.');

try{
  const report=addTrackingScenarios(getDb());
  console.log('Loadgistic tracking scenarios are ready.');
  console.log(JSON.stringify({database:process.env.DATABASE_PATH||'./data/loadgistic.db',...report},null,2));
}finally{
  closeDb();
}
