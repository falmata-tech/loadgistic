import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {excludeRetiredGuestFixtureTables} from '../scripts/fixture-market-policy.mjs';

test('retired Guest fixture data is excluded without changing Provider or Brokerage work or the source export',()=>{
 const tables={
  guest_support_conversations:[{id:'retired-open',status:'OPEN'},{id:'retired-waiting',status:'WAITING'},{id:'retired-closed',status:'CLOSED'}],
  guest_support_messages:[{conversation_id:'retired-open',body:'Synthetic old transcript'}],
  guest_support_attachments:[{conversation_id:'retired-open',file_path:'synthetic-no-upload'}],
  guest_support_events:[{conversation_id:'retired-open',event_type:'ASSIGNED'}],
  guest_support_future_metadata:[{conversation_id:'retired-open'}],
  support_conversations:[{id:'provider-open',status:'OPEN',assigned_agent_user_id:'support-worker'}],
  support_messages:[{conversation_id:'provider-open',body:'Provider request'}],
  support_events:[{conversation_id:'provider-open',event_type:'ASSIGNED'}],
  support_agent_profiles:[{user_id:'support-worker',max_open_conversations:3}],
  transport_service_requests:[{id:'transport-open',status:'NEW',assigned_agent_user_id:'transport-worker'}],
  transport_chat_messages:[{request_id:'transport-open',body:'Transport request'}],
  transport_request_events:[{request_id:'transport-open',event_type:'ASSIGNED'}],
  vehicles:[{id:'truck'}],audit_logs:[{entity_id:'provider-open',action:'SUPPORT_CONVERSATION_ASSIGNED'}]
 };
 const before=structuredClone(tables),result=excludeRetiredGuestFixtureTables(tables);
 assert.deepEqual(tables,before);assert.notEqual(result,tables);assert.ok(Object.keys(result).every(table=>!table.startsWith('guest_support_')));
 for(const[table,rows]of Object.entries(tables).filter(([table])=>!table.startsWith('guest_support_')))assert.equal(result[table],rows,table);
});

test('a future export containing retired queues cannot reintroduce them while current fixture counts remain intact',()=>{
 const fixture=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url),'utf8'));
 const imported=excludeRetiredGuestFixtureTables({...fixture.tables,guest_support_conversations:[{status:'WAITING'}],guest_support_messages:[{body:'Synthetic legacy fixture'}]});
 assert.ok(!Object.hasOwn(imported,'guest_support_conversations'));assert.ok(!Object.hasOwn(imported,'guest_support_messages'));
 assert.equal(imported.users.length,154);assert.equal(imported.vehicles.length,143);assert.equal(imported.capacities.length,143);
 for(const[table,rows]of Object.entries(fixture.tables))if(!table.startsWith('guest_support_'))assert.equal(imported[table],rows,table);
});

test('local importer excludes retired tables before rebasing, authority preparation and any reset',()=>{
 const source=readFileSync(new URL('../scripts/import-supabase-fixtures.mjs',import.meta.url),'utf8');
 const policy=source.indexOf('Object.entries(excludeRetiredGuestFixtureTables(fixtureDocument.tables))');assert.ok(policy>0);
 assert.ok(policy<source.indexOf('prepareProviderAuthorityFixtures({...fixtureDocument'));
 assert.ok(policy<source.indexOf('await deleteLocalFixtures()'));
 assert.match(source.slice(0,policy),/assertLocalAuthorityFixtureTarget\(url\)/);
});

test('post-import verification rejects active retired Guest workload before testing account login',()=>{
 const source=readFileSync(new URL('../scripts/verify-supabase-fixtures.mjs',import.meta.url),'utf8');
 assert.match(source,/from\('guest_support_conversations'\)[\s\S]*?\.in\('status',\['WAITING','OPEN'\]\)/);
 assert.match(source,/if\(retiredGuestWorkload!==0\)throw new Error\('SUPABASE_FIXTURE_VERIFY_RETIRED_GUEST_WORKLOAD_PRESENT'\)/);
 assert.ok(source.indexOf('SUPABASE_FIXTURE_VERIFY_RETIRED_GUEST_WORKLOAD_PRESENT')<source.indexOf('auth.signInWithPassword'));
});
