import { resetDb, closeDb } from '../src/lib/db.js';
import { assertStressDataIntegrity, populateStressData } from './lib/stress-data.mjs';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Stress data is development-only and cannot run in production.');
}

const scale = Number(process.env.STRESS_SCALE || 1);
const db = resetDb();

try {
  const report = populateStressData(db,{scale});
  const integrity = assertStressDataIntegrity(db,report);
  console.log('Loadgistic comprehensive development database is ready.');
  console.log(JSON.stringify({
    database:process.env.DATABASE_PATH || './data/loadgistic.db',
    profile:report.profile,
    counts:report.counts,
    coverage:report.coverage,
    integrity
  },null,2));
  console.log('Generated accounts use predictable @stress.loadgistic.local emails and the documented local demo password.');
} finally {
  closeDb();
}
