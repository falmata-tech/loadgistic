import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PATH = './data/test-authorization.db';
const file = path.resolve(process.cwd(), process.env.DATABASE_PATH);
for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(file + suffix)) fs.rmSync(file + suffix);

const repo = await import('../src/lib/repository.js');
const dbModule = await import('../src/lib/db.js');

const users = {
  admin: repo.getUserById('user-admin'),
  shipper: repo.getUserById('user-shipper'),
  receiver: repo.getUserById('user-receiver'),
  parcel: repo.getUserById('user-parcel'),
  transporter: repo.getUserById('user-transporter'),
  driver: repo.getUserById('user-driver')
};

function createFreight(distributionMode = 'OPEN_MARKET', providerRef = undefined) {
  return repo.createShipment(users.shipper, {
    title: `Authorization ${distributionMode} ${Date.now()} ${Math.random()}`,
    serviceMode: 'FREIGHT',
    distributionMode,
    providerRef,
    priceMode: 'QUOTE_REQUESTED',
    origin: 'Addis Ababa',
    destination: 'Hawassa',
    cargoDescription: 'Permission contract fixture',
    packageCount: '2',
    pickupDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    trackingMode: 'NONE'
  });
}

test('saved-partner freight is visible only to a related provider', () => {
  assert.ok(repo.getShipmentForUser(users.transporter, 'shp-freight-target'));
  assert.equal(repo.getShipmentForUser(users.driver, 'shp-freight-target'), null);
  assert.ok(repo.listLoads(users.transporter).some(row => row.id === 'shp-freight-target'));
  assert.equal(repo.listLoads(users.driver).some(row => row.id === 'shp-freight-target'), false);
});

test('browse visibility cannot change an unassigned shipment status', () => {
  const shipment = createFreight();
  assert.ok(repo.getShipmentForUser(users.driver, shipment.id));
  assert.throws(() => repo.transitionShipment(users.driver, shipment.id, 'CONTACTED'), /NOT_FOUND|FORBIDDEN/);
  assert.equal(repo.getShipmentForUser(users.shipper, shipment.id).operational_status, 'POSTED');
});

test('browse visibility cannot add an internal shipment note', () => {
  const shipment = createFreight();
  const db = dbModule.getDb();
  const before = db.prepare('SELECT COUNT(*) AS n FROM shipment_notes WHERE shipment_id=?').get(shipment.id).n;
  assert.throws(() => repo.addShipmentNote(users.driver, shipment.id, 'Unauthorized internal note'), /NOT_FOUND/);
  const after = db.prepare('SELECT COUNT(*) AS n FROM shipment_notes WHERE shipment_id=?').get(shipment.id).n;
  assert.equal(after, before);
});

test('browse visibility cannot upload or download private proof', () => {
  const shipment = createFreight();
  const upload = { path: '/tmp/loadgistic-authorization-proof.pdf', originalName: 'proof.pdf', mimeType: 'application/pdf' };
  const proofId = repo.addProof(users.admin, shipment.id, 'LOADING', upload, 'Admin fixture');
  assert.equal(repo.getProofFile(users.driver, proofId), null);
  assert.throws(() => repo.addProof(users.driver, shipment.id, 'ISSUE', upload, 'Unauthorized'), /NOT_FOUND/);
  assert.equal(repo.getProofFile(users.shipper, proofId).id, proofId);
});

test('direct shipment acceptance is restricted to the addressed provider and sent state', () => {
  const shipment = createFreight('DIRECT_TO_PROVIDER', 'profile:provider-driver');
  assert.throws(() => repo.acceptDirectedShipment(users.transporter, shipment.id), /NOT_FOUND|FORBIDDEN/);
  repo.acceptDirectedShipment(users.driver, shipment.id);
  assert.equal(repo.getShipmentForUser(users.driver, shipment.id).operational_status, 'AGREED');
  assert.throws(() => repo.acceptDirectedShipment(users.driver, shipment.id), /DIRECT_REQUEST_NOT_PENDING/);
});

test('application review is admin-only and terminal outcomes are immutable', () => {
  const applicationId = repo.createBusinessApplication({
    name: 'Authorization Applicant',
    businessName: 'Authorization Freight PLC',
    email: `authorization-${Date.now()}@loadgistic.local`,
    password: 'StrongPass123!',
    applicationType: 'TRANSPORT_COMPANY',
    notes: 'Permission test'
  });
  assert.throws(() => repo.reviewApplication(users.shipper, applicationId, 'APPROVED'), /FORBIDDEN/);
  repo.reviewApplication(users.admin, applicationId, 'REJECTED', 'Rejected once');
  assert.throws(() => repo.reviewApplication(users.admin, applicationId, 'APPROVED'), /APPLICATION_ALREADY_REVIEWED/);
});

test('payment review is admin-only and terminal outcomes are immutable', () => {
  const proofId = repo.submitPaymentProof(users.shipper, '1500', `AUTH-${Date.now()}`);
  assert.throws(() => repo.reviewPaymentProof(users.shipper, proofId, 'APPROVED'), /FORBIDDEN/);
  repo.reviewPaymentProof(users.admin, proofId, 'APPROVED');
  assert.throws(() => repo.reviewPaymentProof(users.admin, proofId, 'REJECTED'), /PAYMENT_PROOF_ALREADY_REVIEWED/);
  const proof = repo.listPaymentProofs(users.admin).find(row => row.id === proofId);
  assert.equal(proof.status, 'APPROVED');
});

test('role and tenant checks guard remaining mutation boundaries', () => {
  assert.throws(() => repo.createShipment(users.parcel, {
    serviceMode: 'FREIGHT', distributionMode: 'OPEN_MARKET', priceMode: 'QUOTE_REQUESTED'
  }), /FORBIDDEN/);
  assert.throws(() => repo.publishCapacity(users.driver, { vehicleId: 'veh-trans-1', status: 'EMPTY' }), /INVALID_VEHICLE/);
  assert.throws(() => repo.addLocation(users.shipper, { name: 'Unauthorized', city: 'Addis Ababa' }), /FORBIDDEN/);
  assert.throws(() => repo.listApplications(users.shipper), /FORBIDDEN/);
  assert.throws(() => repo.listPaymentProofs(users.shipper), /FORBIDDEN/);
});

test.after(() => {
  dbModule.closeDb();
  for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(file + suffix)) fs.rmSync(file + suffix);
});
