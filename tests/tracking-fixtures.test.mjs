import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PATH='./data/test-tracking-fixtures.db';
const file=path.resolve(process.cwd(),process.env.DATABASE_PATH);
for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);

const dbModule=await import('../src/lib/db.js');
const {addTrackingScenarios}=await import('../scripts/lib/tracking-fixtures.mjs');

test('tracking scenarios are additive, relational, and idempotent',()=>{
  const db=dbModule.getDb();
  db.prepare(`UPDATE shipments SET operational_status='COMPLETED' WHERE id='shp-freight-active'`).run();
  const existingShipments=db.prepare('SELECT COUNT(*) AS n FROM shipments').get().n;
  const existingRelationships=db.prepare('SELECT COUNT(*) AS n FROM partner_relationships').get().n;
  const first=addTrackingScenarios(db);
  const second=addTrackingScenarios(db);
  assert.equal(first.added,5);
  assert.equal(second.added,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM shipments').get().n,existingShipments+5);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM partner_relationships').get().n,existingRelationships);
  assert.equal(db.prepare(`SELECT operational_status FROM shipments WHERE id='shp-freight-active'`).get().operational_status,'COMPLETED');
  const scenarios=db.prepare(`SELECT s.operational_status,s.assigned_vehicle_id,s.assigned_driver_user_id,COUNT(e.id) AS event_count
    FROM shipments s JOIN shipment_events e ON e.shipment_id=s.id WHERE s.code LIKE 'LGX-T3%'
    GROUP BY s.id ORDER BY s.code`).all();
  assert.deepEqual(scenarios.map(item=>item.operational_status),['ASSIGNED','IN_TRANSIT','ISSUE','DELIVERED','COMPLETED']);
  assert.ok(scenarios.every(item=>item.assigned_vehicle_id&&item.assigned_driver_user_id&&item.event_count>=3));
});
