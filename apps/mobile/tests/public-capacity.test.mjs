import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCapacityPage, capacityUrl, loadCapacity, loadSharedCapacity } from '../src/api/public-capacity.ts';
const row = (id, extra = {}) => ({ id, status: 'EMPTY', assigned_driver_first_name: 'Driver', location_lat: 9, location_lng: 38, ...extra });
test('only available assigned trucks enter the projection; private contacts stay out', () => {
 const page = parseCapacityPage({ items: [row('a', { contact_email: 'private@example.test' }), row('b', { status: 'FULL' }), row('c', { assigned_driver_first_name: '' })], hasMore: false });
 assert.equal(page.items.length, 1); assert.equal('contact_email' in page.items[0], false);
});
test('vehicle details keep only explicit public callback phones and safe document metadata',()=>{
 const privateFields={assigned_driver_last_name:'Private surname',assigned_driver_user_id:'private-driver-id',provider_organization_id:'private-owner-id',owner_surname:'Private owner',contact_email:'private@example.test',email:'private-account@example.test',device_id:'private-device',installation_id:'private-installation',proof_storage_path:'supabase://verification/private-proof',document_number:'private-document',storage_path:'private-storage'};
 const badge={type:'DRIVER_IDENTITY',verified:true,expired:false,reviewedAt:'2026-10-22T12:30:00.000Z',expiresOn:'2027-10-22',...privateFields};
 const item=parseCapacityPage({items:[row('safe',{...privateFields,assigned_driver_first_name:'Public first name',assigned_driver_phone:'+251 922 809 000',contact_phone:'+251911111111',driver_verification_badges:[badge],owner_verification_badges:[{...badge,type:'IDENTITY'}],truck_verification_badges:[{...badge,type:'VEHICLE_OWNERSHIP'}]})],hasMore:false}).items[0];
 assert.equal(item.driver,'Public first name');assert.equal(item.driverPhone,'+251922809000');assert.equal(item.providerPhone,'+251911111111');assert.equal(item.ownerDocumentsLabel,'Transport Provider documents');
 assert.deepEqual(item.driverBadges,[{type:'DRIVER_IDENTITY',reviewed:true,expired:false,reviewedAt:'2026-10-22T12:30:00.000Z',expiresOn:'2027-10-22'}]);
 for(const value of Object.values(privateFields))assert.equal(JSON.stringify(item).includes(value),false,value);
});
test('private account phones never replace unpublished callbacks and malformed phones cannot launch contacts',()=>{
 const parse=extra=>parseCapacityPage({items:[row('safe',extra)],hasMore:false}).items[0];
 for(const assigned_driver_phone of [undefined,null,'','javascript:alert(1)','+251\n922809000','abc1234567','123'])assert.equal(parse({assigned_driver_phone,phone:'+251911111111',account_phone:'+251922222222',driver_phone:'+251933333333'}).driverPhone,'');
 assert.equal(parse({contact_phone:'https://example.test'}).providerPhone,'');assert.equal(parse({}).ownerDocumentsLabel,'Owner documents');
});
test('unreviewed, expired and unknown document claims cannot become current reviewed evidence',()=>{
 const item=parseCapacityPage({items:[row('safe',{owner_verification_badges:[null,{type:'PRIVATE_FILE',verified:true,storage_path:'secret'},{type:'IDENTITY',verified:'true',reviewedAt:'private review note'},{type:'BUSINESS_LICENSE',verified:true,expired:true,expiresOn:'2020-01-01'}]})],hasMore:false}).items[0];
 assert.deepEqual(item.ownerBadges,[{type:'IDENTITY',reviewed:false,expired:false,reviewedAt:'',expiresOn:''},{type:'BUSINESS_LICENSE',reviewed:false,expired:true,reviewedAt:'',expiresOn:'2020-01-01'}]);
 for(const status of ['FULL','OFF_DUTY'])assert.equal(parseCapacityPage({items:[row('denied',{status,assigned_driver_phone:'+251911111111'})],hasMore:false}).items.length,0);
 assert.equal(parseCapacityPage({items:[row('unassigned',{assigned_driver_first_name:'',assigned_driver_phone:'+251911111111'})],hasMore:false}).items.length,0);
});
test('invalid coordinates stay off map and malformed pagination fails', () => {
 assert.equal(parseCapacityPage({ items: [row('a', { location_lat: 100 })], hasMore: false }).items[0].latitude, null);
 assert.throws(() => parseCapacityPage({ items: [], hasMore: true }));
});
test('actual saved demo location provenance survives the native projection without private identifiers',()=>{
 const parse=extra=>parseCapacityPage({items:[row('demo',{location_source:'TELEMATICS',...extra})],hasMore:false}).items[0];
 for(const location_source of ['TELEMATICS','PHONE_OBSCURED','MANUAL']){
  const item=parse({location_source,location_is_demo:true,demo_epoch:'private-epoch',installation_id:'private-installation',imei:'private-device'});
  assert.equal(item.locationIsDemo,true);
  for(const field of ['demo_epoch','installation_id','imei','location_is_demo'])assert.equal(Object.hasOwn(item,field),false,field);
 }
 for(const location_is_demo of [undefined,null,false,'true',1,{},[]])assert.equal(parse({location_is_demo}).locationIsDemo,false);
 for(const extra of [{location_lat:null},{location_lng:NaN},{location_lat:91},{current_signal_geometry_visible:false}]){
  assert.equal(parse({...extra,location_is_demo:true}).locationIsDemo,false);
 }
 assert.equal(parse({fixture_source:'loadgistic',demo_mode:'RUNNING'}).locationIsDemo,false,'synthetic identity/source settings are not fix provenance');
});
test('search is encoded; insecure external endpoints and embedded credentials fail', () => {
 assert.equal(new URL(capacityUrl('https://loadgistic.com', 'A&B')).searchParams.get('q'), 'A&B');
 assert.throws(() => capacityUrl('http://example.com', ''));
 assert.throws(() => capacityUrl('https://user:password@loadgistic.com', ''));
});
test('all cursor pages load automatically and duplicate rows collapse', async () => {
 let calls = 0, result;
 await loadCapacity('https://loadgistic.com', '', new AbortController().signal, items => result = items, async (_url, options) => {
 assert.equal(options.credentials, 'omit'); calls++;
 return Response.json({ items: [row('a'), ...(calls === 2 ? [row('b')] : [])], hasMore: calls === 1, nextCursor: calls === 1 ? 'page2' : null });
 });
 assert.equal(calls, 2); assert.equal(result.length, 2);
});
test('repeated cursors fail instead of silently looping or truncating', async () => {
 await assert.rejects(loadCapacity('https://loadgistic.com', '', new AbortController().signal, () => {}, async () => Response.json({ items: [], hasMore: true, nextCursor: 'same' })), /finish loading/);
});
test('aborted response cannot publish stale search data', async () => {
 const c = new AbortController(); let published = false;
 await assert.rejects(loadCapacity('https://loadgistic.com', '', c.signal, () => { published = true; }, async () => { c.abort(); return Response.json({ items: [row('a')], hasMore: false }); }));
 assert.equal(published, false);
});

test('lookalike local hostnames cannot bypass HTTPS', () => {
 for (const host of ['10.evil.example', '192.168.attacker.example', '172.32.1.2']) assert.throws(() => capacityUrl(`http://${host}`, ''));
 for (const host of ['10.0.2.2', '192.168.1.10', '172.16.1.3']) assert.equal(new URL(capacityUrl(`http://${host}:3100`, '')).hostname, host);
});

test('private capacity loads every scoped page and cannot publish after access cancellation', async () => {
 let calls = 0, result;
 await loadSharedCapacity('A&B', new AbortController().signal, items => { result = items; }, async path => {
  assert.equal(new URL(path, 'https://loadgistic.com').searchParams.get('q'), 'A&B'); assert.ok(path.startsWith('/api/mobile/visitor/capacity/signals?')); calls++;
  return { items: [row('a'), ...(calls === 2 ? [row('b')] : [])], hasMore: calls === 1, nextCursor: calls === 1 ? 'next' : null };
 });
 assert.equal(calls, 2); assert.equal(result.length, 2);
 const abort = new AbortController(); let published = false;
 await assert.rejects(loadSharedCapacity('', abort.signal, () => { published = true; }, async () => { abort.abort(); return { items: [row('a')], hasMore: false }; })); assert.equal(published, false);
 await assert.rejects(loadSharedCapacity('', new AbortController().signal, () => {}, async () => ({ items: [], hasMore: true, nextCursor: 'repeat' })), /finish loading/);
});
