import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// This test creates disposable accounts and trucks in the isolated local Loadgistic DB.
// Never accept a remote target or print credentials, OTPs or mailbox contents.
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
assert.ok(/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m.test(env), 'Isolated Loadgistic backend required');
const base = 'http://127.0.0.1:3100';
const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=', 'base64');
const fileCommand = (command, bytes = pngBytes, type = 'image/png') => { const form = new FormData(); form.append('command', JSON.stringify(command)); form.append('file', new Blob([bytes], { type }), 'local-proof.png'); return form; };

async function call(path, body, token) {
 const response = await fetch(base + '/api/mobile/' + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined || body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer '+token } : {}) }, ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
 assert.ok(response.headers.get('content-type')?.includes('application/json'), `Expected JSON from ${path}, status ${response.status}`);
 return { status: response.status, value: await response.json() };
}
for (const route of ['session', 'dashboard', 'invitations']) assert.equal((await call(route)).status, 401);
assert.equal((await call('session', undefined, 'a.b.c')).status, 401);
async function loginLocal(email) {
const start = Date.now();
const requested = await call('auth/request', { email });
assert.equal(requested.status, 200); assert.ok(typeof requested.value.handoff === 'string');
let code;
for (let attempt = 0; attempt < 30 && !code; attempt++) {
 const list = await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json();
 const found = (list.messages || []).find(item => new Date(item.Created).getTime() >= start - 2000 && item.To?.some(to => to.Address === email));
 if (found) { const detail = await (await fetch('http://127.0.0.1:55324/api/v1/message/'+encodeURIComponent(found.ID))).json(); code = String(detail.Text || detail.HTML || '').match(/(?:^|\D)(\d{6})(?:\D|$)/)?.[1]; }
 if (!code) await new Promise(resolve => setTimeout(resolve, 250));
}
assert.ok(code, 'Local OTP delivery required');
const login = await call('auth/verify', { handoff: requested.value.handoff, code });
assert.equal(login.status, 200); return login.value;
}
async function loginVisitor(scope, email) {
 const start = Date.now(), requested = await call(`visitor/${scope}/request`, { email });
 assert.equal(requested.status, 200); assert.equal(requested.value.verificationRequired, true);
 assert.equal('localTestCode' in requested.value, false); assert.equal('accessCode' in requested.value, false);
 let code;
 for (let attempt = 0; attempt < 30 && !code; attempt++) {
  const list = await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json();
  const found = list.messages.find(item => new Date(item.Created).getTime() >= start - 2000 && /code/i.test(item.Subject) && item.To?.some(to => to.Address === email));
  if (found) { const detail = await (await fetch('http://127.0.0.1:55324/api/v1/message/' + found.ID)).json(); code = String(detail.Text || detail.HTML || '').match(/(?:^|\D)(\d{6})(?:\D|$)/)?.[1]; }
  if (!code) await new Promise(resolve => setTimeout(resolve, 250));
 }
 assert.ok(code, 'Visitor email code must reach local inbox');
 const input = { handoff: requested.value.handoff, code };
 assert.equal((await call(`visitor/${scope === 'tracking' ? 'capacity' : 'tracking'}/verify`, input)).status, 401, 'OTP handoff cannot cross scopes');
 const verified = await call(`visitor/${scope}/verify`, input); assert.equal(verified.status, 200, verified.value.error?.message);
 assert.equal((await call(`visitor/${scope}/verify`, input)).status, 401, 'One-time code cannot be replayed');
 return verified.value;
}
const login = { value: await loginLocal(`mobile-proof-${Date.now()}@loadgistic.local`) };
assert.equal(login.value.state, 'ONBOARDING');
const extraSessions = [];
let session = login.value;
try {
 assert.equal((await call('dashboard', undefined, session.accessToken)).status, 403);
 const signup = await call('onboarding', { name: 'Mobile Proof Owner', businessName: 'Mobile Proof Transport', phone: '+251900000099', applicationType: 'OWNER_OPERATOR' }, session.accessToken);
 assert.equal(signup.status, 200);
 const refreshed = await call('auth/refresh', { refreshToken: session.refreshToken });
 assert.equal(refreshed.status, 200); session = refreshed.value; assert.equal(session.state, 'ACTIVE');
 const identity = await call('session', undefined, session.accessToken); assert.equal(identity.status, 200); assert.equal(identity.value.user.id, session.user.id);
 assert.equal((await call('account', { name: 'Mobile Proof Updated', phone: '+251900000099' }, session.accessToken)).status, 200);
 const own = await call('account', undefined, session.accessToken); assert.equal(own.value.name, 'Mobile Proof Updated');
 assert.equal((await call('account', { name: 'Invalid Actor', phone: '', actor_user_id: 'other' }, session.accessToken)).status, 400);
 const plan = await call('billing', undefined, session.accessToken); assert.equal(plan.status, 200); assert.equal(plan.value.status, 'FREE_ACCESS'); assert.equal(plan.value.canSubmit, false);
 assert.equal((await call('billing', { amountEtb: 100, reference: 'No payment needed' }, session.accessToken)).status, 403);
 assert.equal((await call('billing')).status, 401); assert.equal((await call('billing?page=-1', undefined, session.accessToken)).status, 400);

 const truck = await call('fleet', { action: 'ADD_TRUCK', make: 'Isuzu', model: 'GIGA', plate: 'MOB-' + String(Date.now()).slice(-6), cargoConfiguration: 'Medium Box Truck' }, session.accessToken);
 assert.equal(truck.status, 200); assert.ok(truck.value.id, 'Created truck id required');
 const fleet = await call('fleet', undefined, session.accessToken); assert.equal(fleet.status, 200);
 assert.ok(fleet.value.vehicles.some(item => item.id === truck.value.id), 'Created truck must be readable');
 assert.ok(fleet.value.configurations.every(item => item.image.startsWith('/vehicle-configurations/')));
 assert.equal((await call('fleet', { action: 'ASSIGN_DRIVER', driverId: '00000000-0000-4000-8000-000000000000', vehicleId: truck.value.id, canManageCapacity: true, canManageTracking: true }, session.accessToken)).status, 403);

 const capacityBefore = await call('capacity', undefined, session.accessToken); assert.equal(capacityBefore.status, 200);
 assert.ok(capacityBefore.value.vehicles.some(item => item.id === truck.value.id && item.canLocate), 'Owner-operator can locate their assigned truck');
 const place = async query => { const result = await call('places?q=' + encodeURIComponent(query)); assert.equal(result.status, 200); assert.ok(result.value.results[0]?.placeRef, 'City catalog result required'); assert.ok(result.value.results[0].coordinate?.length===2 && result.value.results[0].coordinate.every(Number.isFinite),'Catalog preview coordinate required'); return { placeRef: result.value.results[0].placeRef }; };
 const route = [await place('Addis Ababa'), await place('Adama')];
 const location = { action: 'LOCATION', vehicleId: truck.value.id, approximateLat: 9.15, approximateLng: 38.8, locationPrecisionKm: 20 };
 assert.equal((await call('capacity', { ...location, actor_user_id: session.user.id }, session.accessToken)).status, 400);
 assert.equal((await call('capacity', { ...location, vehicleId: '00000000-0000-4000-8000-000000000000' }, session.accessToken)).status, 403);
 assert.equal((await call('capacity', location, session.accessToken)).status, 200, 'Location bootstrap before first signal');
 const publication = { action: 'PUBLISH', vehicleId: truck.value.id, status: 'EMPTY', acceptedLoads: 'BOTH', availabilityGeometry: 'ROUTE', currentRoutePlaces: route, capacityAreaCenterPlaceRef: '', capacityAreaBoundaryPlaces: [], acceptsMultiPick: false, acceptsMultiDrop: false };
 const published = await call('capacity', publication, session.accessToken); assert.equal(published.status, 200, published.value.error?.message);
 const savedCapacity = await call('capacity', undefined, session.accessToken), savedTruck = savedCapacity.value.vehicles.find(item => item.id === truck.value.id);
 assert.equal(savedTruck.current.visibility, 'PRIVATE'); assert.equal(savedTruck.current.status, 'EMPTY'); assert.equal(savedTruck.current.route.length, 2); assert.ok(savedTruck.current.route.every(place=>place.coordinate?.length===2 && place.coordinate.every(Number.isFinite)),'Saved current-route preview coordinates');
 assert.equal(JSON.stringify(savedCapacity.value).includes('photo_storage_path'), false);
 assert.equal((await call('capacity', { ...publication, currentRoutePlaces: [{ placeRef: 'invalid' }, route[1]] }, session.accessToken)).status, 400);
 assert.equal((await call('capacity', { ...publication, status: 'OFF_DUTY' }, session.accessToken)).status, 200);
 console.log('PASS: assigned driver location bootstrap; invalid truck/actor denial; city selection; private-by-default capacity save/readback; invalid place rejection; Off Duty');


 const companyEmail = `mobile-company-${Date.now()}@loadgistic.local`;
 let company = await loginLocal(companyEmail); extraSessions.push(company);
 assert.equal((await call('onboarding', { name: 'Mobile Fleet Owner', businessName: 'Mobile Test Fleet', phone: '+251900000097', applicationType: 'TRANSPORT_COMPANY' }, company.accessToken)).status, 200);
 const companyRefresh = await call('auth/refresh', { refreshToken: company.refreshToken }); assert.equal(companyRefresh.status, 200); company = companyRefresh.value; extraSessions[0] = company;
 const companyTruck = await call('fleet', { action: 'ADD_TRUCK', make: 'Isuzu', model: 'GIGA', plate: 'FLEET-' + String(Date.now()).slice(-6), cargoConfiguration: 'Medium Box Truck' }, company.accessToken);
 assert.equal(companyTruck.status, 200);
 const driverEmail = `mobile-driver-${Date.now()}@loadgistic.local`;
 const added = await call('fleet', { action: 'ADD_DRIVER', name: 'Mobile Company Driver', email: driverEmail, phone: '+251900000096' }, company.accessToken);
 assert.equal(added.status, 200);
 const assignment = { action: 'ASSIGN_DRIVER', driverId: added.value.id, vehicleId: companyTruck.value.id, canManageCapacity: false, canManageTracking: false };
 assert.equal((await call('fleet', assignment, company.accessToken)).status, 200, 'Assignment must work before driver email verification');
 const driver = await loginLocal(driverEmail); extraSessions.push(driver); assert.equal(driver.state, 'ACTIVE');
 const regular = { action: 'SAVE', replaceId: null, geometry: 'ROUTE', routePlaces: route, areaCenterPlaceRef: '', areaBoundaryPlaces: [] };
 assert.equal((await call('regular-service', regular, driver.accessToken)).status, 403);
 assert.equal((await call('regular-service', { ...regular, actorId: company.user.id }, company.accessToken)).status, 400);
 assert.equal((await call('regular-service', regular, company.accessToken)).status, 200);
 const savedService = (await call('regular-service', undefined, company.accessToken)).value.services[0]; assert.equal(savedService.route.length, 2); assert.ok(savedService.route.every(place=>place.coordinate?.length===2 && place.coordinate.every(Number.isFinite)),'Saved regular-route preview coordinates');
 assert.equal((await call('regular-service', regular, company.accessToken)).status, 400, 'One regular service per owner');
 const invalidReplacement = { ...regular, replaceId: savedService.id, routePlaces: [route[0], route[0]] };
 assert.equal((await call('regular-service', invalidReplacement, company.accessToken)).status, 400);
 assert.equal((await call('regular-service', undefined, company.accessToken)).value.services[0].id, savedService.id, 'Invalid replacement retains previous service atomically');
 assert.equal((await call('regular-service', { ...regular, replaceId: savedService.id }, session.accessToken)).status, 403);
 const removeService = { action: 'REMOVE', id: savedService.id, confirm: true };
 assert.equal((await call('regular-service', removeService, driver.accessToken)).status, 403);
 assert.equal((await call('regular-service', removeService, session.accessToken)).status, 403);
 assert.equal((await call('regular-service', { ...removeService, confirm: false }, company.accessToken)).status, 400);
 assert.equal((await call('regular-service', removeService, company.accessToken)).status, 200);
 assert.equal((await call('regular-service', undefined, company.accessToken)).value.services.length, 0);
 console.log('PASS: owner regular-service persistence; single-service limit; atomic invalid replacement; driver/cross-owner/spoof denial; confirmed removal');

 const documents = await call('verification', undefined, company.accessToken); assert.equal(documents.status, 200);
 const truckSubject = documents.value.subjects.find(item => item.id === companyTruck.value.id); assert.equal(truckSubject.kind, 'VEHICLE');
 const ownership = { subjectId: truckSubject.id, subjectType: truckSubject.kind, verificationType: 'VEHICLE_OWNERSHIP', documentName: 'Local truck ownership' };
 assert.equal((await call('verification', fileCommand(ownership), session.accessToken)).status, 403);
 assert.equal((await call('verification', fileCommand({ ...ownership, actor_user_id: company.user.id }), company.accessToken)).status, 400);
 assert.equal((await call('verification', fileCommand(ownership, Buffer.from('fake-png')), company.accessToken)).status, 400);
 assert.equal((await call('verification', fileCommand({ ...ownership, verificationType: 'VEHICLE_AUTHORIZATION' }), company.accessToken)).status, 400);
 assert.equal((await call('verification', fileCommand(ownership), company.accessToken)).status, 200);
 assert.equal((await call('verification', fileCommand(ownership), company.accessToken)).status, 409);
 const documentReadback = await call('verification', undefined, company.accessToken), submittedDocument = documentReadback.value.requests.find(item => item.subjectId === truckSubject.id);
 assert.equal(submittedDocument.status, 'PENDING');
 const documentPath = 'verification/' + submittedDocument.id, openedDocument = await call(documentPath, undefined, company.accessToken);
 assert.equal(openedDocument.status, 200); assert.equal(openedDocument.value.base64, pngBytes.toString('base64')); assert.deepEqual(Object.keys(openedDocument.value).sort(), ['base64', 'mimeType']);
 assert.ok([403, 404].includes((await call(documentPath, undefined, session.accessToken)).status));
 assert.equal((await call(documentPath)).status, 401);
 console.log('PASS: native document ownership scope; actor spoof/invalid bytes/permission expiry rejection; actual private upload/readback; duplicate prevention; cross-owner file denial');

 const driverWorkspace = await call('capacity', undefined, driver.accessToken);
 assert.equal(driverWorkspace.value.canPublish, false); assert.equal(driverWorkspace.value.vehicles.length, 1); assert.equal(driverWorkspace.value.vehicles[0].canLocate, true);
 const fleetLocation = { ...location, vehicleId: companyTruck.value.id }, fleetPublication = { ...publication, vehicleId: companyTruck.value.id };
 assert.equal((await call('capacity', fleetLocation, company.accessToken)).status, 403, 'Owner cannot submit driver device location');
 assert.equal((await call('capacity', fleetLocation, session.accessToken)).status, 403, 'Other provider cannot locate this fleet truck');
 assert.equal((await call('capacity', fleetPublication, session.accessToken)).status, 403, 'Other provider cannot publish this fleet truck');
 assert.equal((await call('capacity', fleetLocation, driver.accessToken)).status, 200, 'Restricted driver may bootstrap location');
 assert.equal((await call('capacity', fleetPublication, driver.accessToken)).status, 403, 'Restricted driver cannot publish');
 assert.equal((await call('capacity', fleetPublication, company.accessToken)).status, 200, 'Fleet owner publishes using assigned driver location');
 assert.equal((await call('fleet', { ...assignment, canManageCapacity: true }, company.accessToken)).status, 200);
 assert.equal((await call('capacity', { ...fleetPublication, status: 'PARTIAL' }, driver.accessToken)).status, 200, 'Existing session sees newly granted permission');
 assert.equal((await call('fleet', assignment, company.accessToken)).status, 200);
 assert.equal((await call('capacity', fleetPublication, driver.accessToken)).status, 403, 'Existing session loses revoked permission');
 const capacityEmail = `mobile-private-${Date.now()}@loadgistic.local`;
 const shareCommand = { action: 'GRANT', vehicleId: companyTruck.value.id, email: capacityEmail };
 assert.equal((await call('network', shareCommand, driver.accessToken)).status, 404, 'Restricted driver cannot manage private grants');
 assert.equal((await call('network', shareCommand, session.accessToken)).status, 404, 'Another provider cannot grant fleet access');
 assert.equal((await call('network', shareCommand, company.accessToken)).status, 200);
 assert.equal((await call('network', shareCommand, company.accessToken)).status, 200, 'Duplicate grant is idempotent');
 const network = await call('network', undefined, company.accessToken), networkTruck = network.value.vehicles.find(item => item.id === companyTruck.value.id);
 assert.equal(networkTruck.grants.filter(item => item.email === capacityEmail).length, 1); assert.equal(JSON.stringify(network.value).includes('recipient_email_digest'), false);
 const capacityVisitor = await loginVisitor('capacity', capacityEmail);
 assert.equal((await call('visitor/capacity/signals', undefined, capacityVisitor.token)).value.items.length, 0, 'Unpublished provider remains hidden even with an email grant');
 const profile = await call('profile', undefined, company.accessToken); assert.equal(profile.status, 200); assert.equal(profile.value.profile.published, false);
 assert.equal((await call('dashboard', undefined, company.accessToken)).value.profilePublished, false);
 assert.equal((await call('profile', undefined, driver.accessToken)).status, 403, 'Company driver cannot manage owner profile');
 const { basePlaceLabel, ...profileCommand } = profile.value.profile;
 Object.assign(profileCommand, { basePlaceRef: route[0].placeRef, baseRegionCode: 'ADDIS_ABABA', published: true });
 assert.equal((await call('profile', { ...profileCommand, actor_user_id: company.user.id }, company.accessToken)).status, 400);
 assert.equal((await call('profile', { ...profileCommand, basePlaceRef: 'invalid' }, company.accessToken)).status, 400);
 assert.equal((await call('profile', profileCommand, driver.accessToken)).status, 403);
 const profileSaved = await call('profile', profileCommand, company.accessToken); assert.equal(profileSaved.status, 200, profileSaved.value.error?.message);
 const profileRead = await call('profile', undefined, company.accessToken); assert.equal(profileRead.value.profile.published, true); assert.equal(profileRead.value.profile.showContactEmail, false);
 assert.equal((await call('dashboard', undefined, company.accessToken)).value.profilePublished, true);

 assert.equal((await call('profile/image', fileCommand({ action: 'UPLOAD' }), driver.accessToken)).status, 403);
 assert.equal((await call('profile/image', fileCommand({ action: 'UPLOAD', actorId: company.user.id }), company.accessToken)).status, 400);
 assert.equal((await call('profile/image', fileCommand({ action: 'UPLOAD' }), company.accessToken)).status, 200);
 assert.equal((await call('profile/image', undefined, company.accessToken)).value.base64, pngBytes.toString('base64'));
 assert.equal((await call('profile/image', undefined, driver.accessToken)).status, 403);
 const imageProfile = await call('profile', undefined, company.accessToken); assert.equal(imageProfile.value.customImage, true); assert.ok(imageProfile.value.imageUrl.startsWith('/api/public/providers/'));
 assert.equal((await call('profile/image', { action: 'REMOVE' }, company.accessToken)).status, 400);
 assert.equal((await call('profile/image', { action: 'REMOVE', confirm: true }, company.accessToken)).status, 200);
 assert.equal((await call('profile', undefined, company.accessToken)).value.customImage, false);
 console.log('PASS: profile draft visibility; native publishing; driver and actor-spoof denial; invalid city rejection; private contact defaults');
 const shared = await call('visitor/capacity/signals', undefined, capacityVisitor.token); assert.equal(shared.status, 200); assert.equal(shared.value.items.length, 1); assert.equal(shared.value.items[0].vehicle_id, companyTruck.value.id); assert.ok(shared.value.items[0].assigned_driver_first_name);
 assert.equal((await call('visitor/tracking/shipments', undefined, capacityVisitor.token)).status, 401);
 assert.equal((await call('visitor/capacity/renew', {}, capacityVisitor.token)).status, 200);
 assert.equal((await call('network', { action: 'LOADGISTIC', vehicleId: companyTruck.value.id, enabled: true }, company.accessToken)).status, 200);
 assert.equal((await call('network', undefined, company.accessToken)).value.vehicles.find(item => item.id === companyTruck.value.id).loadgistic, true);
 assert.equal((await call('network', { action: 'LOADGISTIC', vehicleId: companyTruck.value.id, enabled: false }, company.accessToken)).status, 200);
 assert.equal((await call('network', { action: 'REVOKE', grantId: networkTruck.grants.find(item => item.email === capacityEmail).id }, company.accessToken)).status, 200);
 assert.equal((await call('visitor/capacity/signals', undefined, capacityVisitor.token)).value.items.length, 0, 'Existing visitor token sees grant revocation immediately');
 assert.equal((await call('visitor/capacity/request', { email: `unknown-private-${Date.now()}@loadgistic.local` })).value.verificationRequired, false);
 console.log('PASS: native network permission denial; idempotent grant; capacity inbox OTP; scoped truck read; cross-scope denial; renewal; explicit Loadgistic sharing toggle; live private-capacity revocation');
 assert.equal((await call('capacity', { action: 'DUTY', vehicleId: companyTruck.value.id, onDuty: false }, driver.accessToken)).status, 200);
 // Native Tracking uses the same database authority as the web workspace.
 const trackingInput = { vehicleId: companyTruck.value.id, originPlaceRef: route[0].placeRef, destinationPlaceRef: route[1].placeRef, cargoSummary: 'Local tracking test cargo', customerEmail: `mobile-customer-${Date.now()}@loadgistic.local`, trackingMode: 'LOCATION_AND_STATUS' };
 assert.equal((await call('shipments', trackingInput, driver.accessToken)).status, 403, 'Restricted driver cannot create tracking');
 assert.equal((await call('shipments', { ...trackingInput, actor_user_id: company.user.id }, company.accessToken)).status, 400);
 const shipment = await call('shipments', trackingInput, company.accessToken); assert.equal(shipment.status, 201, shipment.value.error?.message);
 assert.deepEqual(Object.keys(shipment.value).sort(), ['code', 'id']);
 const path = 'shipments/' + shipment.value.id;
 const retire = { action: 'LIFECYCLE', vehicleId: companyTruck.value.id, active: false, reason: 'Local lifecycle verification', confirm: true };
 assert.equal((await call('fleet', retire, driver.accessToken)).status, 403);
 assert.equal((await call('fleet', retire, session.accessToken)).status, 403);
 assert.equal((await call('fleet', { ...retire, confirm: false }, company.accessToken)).status, 400);
 assert.equal((await call('fleet', retire, company.accessToken)).status, 400, 'Active tracking blocks retirement');
 assert.equal((await call(path, undefined, session.accessToken)).status, 404, 'Another provider cannot read shipment');
 assert.equal((await call(path, { action: 'STATUS', nextStatus: 'LOADING' }, session.accessToken)).status, 404, 'Another provider cannot update shipment');
 assert.equal((await call(path, { action: 'STATUS', nextStatus: 'LOADING' }, driver.accessToken)).status, 404, 'Driver tracking permission required');
 assert.equal((await call('fleet', { ...assignment, canManageTracking: true }, company.accessToken)).status, 200);
 const detail = await call(path, undefined, driver.accessToken); assert.equal(detail.status, 200); assert.equal(detail.value.canLocate, true);
 assert.equal(detail.value.recipients.length, 1); assert.equal(detail.value.recipients[0].owner, true);
 for (const key of ['tracking_access_code', 'tracking_code_hash', 'review_code_hash', 'proof_storage_path', 'recipient_email_digest']) assert.equal(JSON.stringify(detail.value).includes(key), false);
 assert.equal((await call(path, { action: 'REVOKE_RECIPIENT', recipientId: detail.value.recipients[0].id }, company.accessToken)).status, 400, 'Cannot revoke customer');
 const recipientEmail = `mobile-recipient-${Date.now()}@loadgistic.local`;
 assert.equal((await call(path, { action: 'ADD_RECIPIENT', email: recipientEmail }, company.accessToken)).status, 200);
 const recipientDetail = await call(path, undefined, company.accessToken), recipient = recipientDetail.value.recipients.find(item => item.email === recipientEmail);
 assert.ok(recipient && !recipient.revoked);
 const visitor = await loginVisitor('tracking', recipientEmail), guestPath = 'visitor/tracking/shipments/' + shipment.value.id;
 assert.equal((await call('session', undefined, visitor.token)).status, 401, 'Visitor token cannot authorize a provider');
 assert.equal((await call(guestPath, undefined, company.accessToken)).status, 401, 'Provider token cannot authorize visitor scope');
 assert.equal((await call('visitor/capacity/signals', undefined, visitor.token)).status, 401, 'Tracking token cannot read private capacity');
 const guestList = await call('visitor/tracking/shipments', undefined, visitor.token); assert.equal(guestList.status, 200); assert.equal(guestList.value.total, 1);
 const guest = await call(guestPath, undefined, visitor.token); assert.equal(guest.status, 200); assert.equal(guest.value.id, shipment.value.id); assert.equal(guest.value.canReview, false);
 assert.equal((await call('visitor/tracking/shipments/00000000-0000-4000-8000-000000000000', undefined, visitor.token)).status, 404);
 assert.equal((await call(guestPath, { rating: 5, note: '' }, visitor.token)).status, 403);
 assert.equal((await call('visitor/tracking/renew', {}, visitor.token)).status, 200);


 assert.equal((await call(path, fileCommand({ action: 'STATUS', nextStatus: 'ISSUE', note: 'Local photo proof check' }), session.accessToken)).status, 404);
 assert.equal((await call(path, fileCommand({ action: 'STATUS', nextStatus: 'ISSUE', note: 'Local photo proof check' }), driver.accessToken)).status, 200);
 const withProof = await call(path, undefined, company.accessToken), proofEvent = withProof.value.events.find(item => item.hasProof);
 assert.ok(proofEvent); const proofPath = path + '/proof/' + proofEvent.id, guestProofPath = guestPath + '/proof/' + proofEvent.id;
 assert.equal((await call(proofPath, undefined, company.accessToken)).value.base64, pngBytes.toString('base64'));
 assert.equal((await call(guestProofPath, undefined, visitor.token)).value.base64, pngBytes.toString('base64'));
 assert.ok([403, 404].includes((await call(proofPath, undefined, session.accessToken)).status));
 assert.equal((await call(guestProofPath, undefined, company.accessToken)).status, 401);
 assert.equal((await call(path, fileCommand({ action: 'STATUS', nextStatus: 'COMPLETED' }), driver.accessToken)).status, 400);
 assert.equal((await call(path, { action: 'REVOKE_RECIPIENT', recipientId: recipient.id }, company.accessToken)).status, 200);
 assert.equal((await call(path, undefined, company.accessToken)).value.recipients.find(item => item.id === recipient.id).revoked, true);
 assert.equal((await call(guestPath, undefined, visitor.token)).status, 404, 'Revocation applies to a still-signed mobile visitor token');
 assert.ok([403, 404].includes((await call(guestProofPath, undefined, visitor.token)).status), 'Revoked visitors cannot read proof files');
 assert.equal((await call('visitor/tracking/shipments', undefined, visitor.token)).value.total, 0);
 assert.equal((await call('visitor/tracking/renew', {}, visitor.token)).status, 401);
 console.log('PASS: actual photo proof upload/readback; owner/driver access; cross-owner/scope denial; recipient revocation immediately closes file access');

 assert.equal((await call(path, { action: 'STATUS', nextStatus: 'COMPLETED' }, company.accessToken)).status, 400, 'Cannot skip journey');
 assert.equal((await call(path, { action: 'STATUS', nextStatus: 'ISSUE', note: '' }, company.accessToken)).status, 400, 'Issue needs note');
 const trackingFix = { approximateLat: 9.15, approximateLng: 38.8, locationPrecisionKm: 20 };
 assert.equal((await call(path, { action: 'STATUS', nextStatus: 'TO_PICKUP', location: trackingFix }, company.accessToken)).status, 403, 'Owner cannot claim driver device fix');
 assert.equal((await call(path, { action: 'STATUS', nextStatus: 'TO_PICKUP' }, driver.accessToken)).status, 400, 'Travel requires fix');
 assert.equal((await call(path, { action: 'STATUS', nextStatus: 'TO_PICKUP', location: trackingFix }, driver.accessToken)).status, 200);
 assert.equal((await call(path, { action: 'STATUS', nextStatus: 'LOADING' }, driver.accessToken)).status, 200);
 assert.equal((await call('fleet', assignment, company.accessToken)).status, 200);
 assert.equal((await call(path, { action: 'STATUS', nextStatus: 'IN_TRANSIT', location: trackingFix }, driver.accessToken)).status, 404, 'Revoked tracking permission takes immediate effect');
 assert.equal((await call('fleet', { ...assignment, canManageTracking: true }, company.accessToken)).status, 200);
 for (const nextStatus of ['IN_TRANSIT', 'UNLOADING', 'COMPLETED']) assert.equal((await call(path, { action: 'STATUS', nextStatus, ...(nextStatus === 'IN_TRANSIT' ? { location: trackingFix } : {}) }, driver.accessToken)).status, 200);
 const recoveryShipment = await call('shipments', { ...trackingInput, trackingMode: 'STATUS_ONLY' }, company.accessToken); assert.equal(recoveryShipment.status, 201);
 const recoveryPath = 'shipments/' + recoveryShipment.value.id + '/recovery';
 assert.equal((await call(recoveryPath, undefined, driver.accessToken)).status, 404, 'Company tracking permission must not grant owner recovery');
 assert.equal((await call(recoveryPath, undefined, session.accessToken)).status, 404);
 let recovery = await call(recoveryPath, undefined, company.accessToken); assert.equal(recovery.status, 200);
 const correction = { action: 'CORRECT', revision: recovery.value.revision, reason: 'Correct local test cargo', cargo_summary: 'Corrected local cargo', origin_place_ref: route[0].placeRef, destination_place_ref: route[1].placeRef, expected_pickup_date: '', expected_delivery_date: '' };
 assert.equal((await call(recoveryPath, correction, driver.accessToken)).status, 404);
 assert.equal((await call(recoveryPath, { ...correction, reason: 'no' }, company.accessToken)).status, 400);
 assert.equal((await call(recoveryPath, correction, company.accessToken)).status, 200);
 assert.equal((await call(recoveryPath, correction, company.accessToken)).status, 409, 'Stale revision must not overwrite correction');
 recovery = await call(recoveryPath, undefined, company.accessToken); assert.equal(recovery.value.cargo, 'Corrected local cargo');
 const replacementTruck = await call('fleet', { action: 'ADD_TRUCK', make: 'Isuzu', model: 'GIGA', plate: 'SWAP-' + String(Date.now()).slice(-6), cargoConfiguration: 'Medium Box Truck' }, company.accessToken); assert.equal(replacementTruck.status, 200);
 const replacementDriver = await call('fleet', { action: 'ADD_DRIVER', name: 'Local Replacement Driver', email: `mobile-replacement-${Date.now()}@loadgistic.local`, phone: '+251900000095' }, company.accessToken); assert.equal(replacementDriver.status, 200);
 assert.equal((await call('fleet', { action: 'ASSIGN_DRIVER', vehicleId: replacementTruck.value.id, driverId: replacementDriver.value.id, canManageCapacity: true, canManageTracking: true }, company.accessToken)).status, 200);
 assert.equal((await call(recoveryPath, { action: 'REASSIGN', revision: recovery.value.revision, reason: 'Replace test truck', vehicle_id: replacementTruck.value.id }, company.accessToken)).status, 200);
 recovery = await call(recoveryPath, undefined, company.accessToken); assert.equal(recovery.value.vehicleId, replacementTruck.value.id);
 assert.equal((await call(recoveryPath, { action: 'CANCEL', revision: recovery.value.revision, reason: 'Finished local verification' }, company.accessToken)).status, 400, 'Cancellation requires explicit confirmation');
 assert.equal((await call(recoveryPath, { action: 'CANCEL', revision: recovery.value.revision, reason: 'Finished local verification', confirm: 'CANCEL' }, company.accessToken)).status, 200);
 const cancelled = await call('shipments/' + recoveryShipment.value.id, undefined, company.accessToken); assert.equal(cancelled.value.status, 'CANCELLED'); assert.equal(cancelled.value.canManageRecipients, false); assert.ok(cancelled.value.events.length > 0);
 assert.equal((await call(recoveryPath, undefined, company.accessToken)).value.actions.length, 0);
 console.log('PASS: owner-only recovery; required reason; stale revision rejection; correction; replacement truck/driver; confirmed cancellation retains history and ends access');
 const completed = await call(path, undefined, company.accessToken); assert.equal(completed.value.status, 'COMPLETED'); assert.equal(completed.value.nextStatuses.length, 0); assert.equal(completed.value.canManageRecipients, false); assert.ok(completed.value.location.area); assert.deepEqual(completed.value.events.map(item => item.status).sort(), ['CREATED', 'ISSUE', 'TO_PICKUP', 'LOADING', 'IN_TRANSIT', 'UNLOADING', 'COMPLETED'].sort(), 'Journey retains the additional photo-proof issue event');
 assert.equal((await call(path, { action: 'STATUS', nextStatus: 'LOADING' }, driver.accessToken)).status, 400);
 let received = false;
 for (let attempt = 0; attempt < 20 && !received; attempt++) { const mailbox = await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json(); received = mailbox.messages.some(item => item.To?.some(to => to.Address === trackingInput.customerEmail)); if (!received) await new Promise(resolve => setTimeout(resolve, 250)); }
 assert.ok(received, 'Customer tracking invitation must reach local mailbox');
 const ownerVisitor = await loginVisitor('tracking', trackingInput.customerEmail);
 const ownerRead = await call(guestPath, undefined, ownerVisitor.token); assert.equal(ownerRead.value.canReview, true);
 assert.equal((await call(guestPath, { rating: 5, note: 'Local mobile verification' }, ownerVisitor.token)).status, 200);
 assert.equal((await call(guestPath, { rating: 4 }, ownerVisitor.token)).status, 403, 'Only one review is permitted');
 assert.equal((await call(guestPath, undefined, ownerVisitor.token)).value.review.rating, 5);
 const unknown = await call('visitor/tracking/request', { email: `no-shares-${Date.now()}@loadgistic.local` });
 assert.equal(unknown.status, 200); assert.equal(unknown.value.verificationRequired, true); assert.deepEqual(Object.keys(unknown.value).sort(), ['handoff', 'message', 'verificationRequired']);
 console.log('PASS: native visitor inbox OTP; replay/cross-scope denial; provider/visitor separation; shared-only reads; live revocation and renewal denial; customer-only one-time review; non-enumerating Tracking request');
 console.log('PASS: native tracking create/outbox; cross-provider and restricted-driver denial; live tracking permission revocation; driver-only travel fix; invalid/terminal transitions; recipient save/revoke and owner protection; private projection; local customer invitation');
 assert.equal((await call('fleet', { ...assignment, vehicleId: '' }, company.accessToken)).status, 200);
 assert.equal((await call('capacity', fleetLocation, driver.accessToken)).status, 403, 'Removed assignment cannot update location');
 console.log('PASS: company signup; driver assignment before email verification; driver OTP login; owner device denial; actual cross-provider denial; restricted location bootstrap; owner publication; live permission grant/revocation; Off Duty; unassignment denial');

 const editTruck = { action: 'EDIT_TRUCK', vehicleId: companyTruck.value.id, make: 'Isuzu', model: 'GIGA edited', plate: 'EDIT-' + String(Date.now()).slice(-6), cargoConfiguration: 'Medium Box Truck' };
 assert.equal((await call('fleet', editTruck, driver.accessToken)).status, 403);
 assert.equal((await call('fleet', editTruck, session.accessToken)).status, 403);
 assert.equal((await call('fleet', { ...editTruck, actor_user_id: company.user.id }, company.accessToken)).status, 400);
 assert.equal((await call('fleet', editTruck, company.accessToken)).status, 200);
 assert.equal((await call('fleet', undefined, company.accessToken)).value.vehicles.find(item => item.id === companyTruck.value.id).model, 'GIGA edited');
 assert.equal((await call('fleet', retire, company.accessToken)).status, 200);
 const retiredFleet = await call('fleet', undefined, company.accessToken); assert.ok(retiredFleet.value.retired.some(item => item.id === companyTruck.value.id)); assert.equal(retiredFleet.value.vehicles.some(item => item.id === companyTruck.value.id), false);
 assert.equal((await call('fleet', { ...retire, active: true }, company.accessToken)).status, 200);
 assert.ok((await call('fleet', undefined, company.accessToken)).value.vehicles.some(item => item.id === companyTruck.value.id));
 const retained = await call(path, undefined, company.accessToken); assert.equal(retained.value.status, 'COMPLETED'); assert.deepEqual(retained.value.events.map(item => item.id).sort(), completed.value.events.map(item => item.id).sort(), 'Retirement and restoration retain every historical event');
 const trailer = await call('fleet', { action: 'ADD_TRUCK', make: 'Volvo', model: 'FH', plate: 'TRLR-' + String(Date.now()).slice(-6), cargoConfiguration: 'Tractor + Container Trailer', trailerInterchangeable: true, supportedTrailerConfigurations: ['Tractor + Container Trailer', 'Tractor + Dry Van Trailer'] }, company.accessToken); assert.equal(trailer.status, 200);
 const attach = { action: 'TRAILER', vehicleId: trailer.value.id, cargoConfiguration: 'Tractor + Dry Van Trailer' };
 assert.equal((await call('fleet', attach, driver.accessToken)).status, 403); assert.equal((await call('fleet', attach, session.accessToken)).status, 403);
 assert.equal((await call('fleet', { ...attach, cargoConfiguration: 'Tractor + Heavy Equipment Trailer' }, company.accessToken)).status, 400);
 assert.equal((await call('fleet', attach, company.accessToken)).status, 200);
 const trailerRead = (await call('fleet', undefined, company.accessToken)).value.vehicles.find(item => item.id === trailer.value.id); assert.equal(trailerRead.configuration, attach.cargoConfiguration); assert.equal(trailerRead.interchangeable, true);
 const contact = { action: 'DRIVER_CONTACT', driverId: added.value.id, name: 'Updated Company Driver', phone: '+251900000093' };
 assert.equal((await call('fleet', contact, driver.accessToken)).status, 403); assert.equal((await call('fleet', contact, session.accessToken)).status, 403); assert.equal((await call('fleet', contact, company.accessToken)).status, 200);
 assert.equal((await call('fleet', undefined, company.accessToken)).value.drivers.find(item => item.id === added.value.id).phone, contact.phone);
 assert.equal((await call('fleet', { action: 'REMOVE_DRIVER', driverId: added.value.id, confirm: false }, company.accessToken)).status, 400);
 assert.equal((await call('fleet', { action: 'REMOVE_DRIVER', driverId: added.value.id, confirm: true }, company.accessToken)).status, 200);
 assert.equal((await call('capacity', undefined, driver.accessToken)).status, 403, 'Removed driver session loses fleet access');
 console.log('PASS: native truck editing; active-work retirement lock; history-preserving retire/restore; supported trailer selection; driver contact/remove; cross-owner and driver denial');

 const dashboard = await call('dashboard', undefined, session.accessToken); assert.equal(dashboard.status, 200); assert.ok(Array.isArray(dashboard.value.counts));
 assert.equal((await call('onboarding', { name: 'Duplicate', businessName: 'Duplicate', phone: '+251900000099', applicationType: 'OWNER_OPERATOR' }, session.accessToken)).status, 403);
 console.log('PASS: denied anonymous/forged access; local OTP; inactive dashboard denial; onboarding; refresh; actor-bound dashboard; account edit; truck persistence; unavailable driver assignment denial; duplicate workspace denial');
} finally {
 for (const extra of extraSessions) { const result = await call('auth/logout', { accessToken: extra.accessToken, refreshToken: extra.refreshToken }); assert.equal(result.status, 200); }
 const result = await call('auth/logout', { accessToken: session.accessToken, refreshToken: session.refreshToken });
 assert.equal(result.status, 200);
 const revoked = await call('auth/refresh', { refreshToken: session.refreshToken }); assert.equal(revoked.status, 401);
 console.log('PASS: logout revokes refresh; no token or code printed');
}
