import { resetDb, closeDb } from '../src/lib/db.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Stress data is development-only and cannot run in production.');
}

const db = resetDb();

try {
  const counts={
    transporters:Number(db.prepare("SELECT COUNT(*) AS n FROM organizations WHERE type='TRANSPORT_COMPANY'").get().n)+Number(db.prepare('SELECT COUNT(*) AS n FROM provider_profiles').get().n),
    trucks:Number(db.prepare('SELECT COUNT(*) AS n FROM vehicles WHERE active=1').get().n),
    currentCapacity:Number(db.prepare(`SELECT COUNT(*) AS n FROM capacities c WHERE c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')`).get().n),
    featured:Number(db.prepare('SELECT COUNT(*) AS n FROM featured_provider_slots').get().n)
  };
  if(counts.transporters<20||counts.trucks<30||counts.currentCapacity<30)throw new Error(`Current stress fixture is too small: ${JSON.stringify(counts)}`);
  console.log('Loadgistic current-product stress database is ready.');
  console.log(JSON.stringify({
    database:process.env.DATABASE_PATH || './data/loadgistic.db',
    counts,
    coverage:['public Truck Market','Daily Featured Transporters','transporter microsites','fleet and Driver workspaces','provider-owned Tracking']
  },null,2));
  console.log('Current local fixture accounts use the documented local development password.');
} finally {
  closeDb();
}
