import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {supportHistoryCursor,supportMessageWindow,supportHistoryHref} from '../src/lib/support-history.js';

const id='00000000-0000-0000-0000-000000000051';
test('history cursors reject malformed or structured client values',()=>{
  assert.equal(supportHistoryCursor(undefined),null);
  assert.equal(supportHistoryCursor(''),null);
  assert.equal(supportHistoryCursor(id),id);
  for(const invalid of ['51','other-conversation',`${id}&admin=true`,{},[id]])assert.throws(()=>supportHistoryCursor(invalid),/INVALID_SUPPORT_CURSOR/);
});
test('latest and terminal historical windows expose only valid navigation',()=>{
  assert.deepEqual(supportMessageWindow({messages:[{id}],message_count:2}),{messages:[{id}],message_count:2,history_before:null,has_older:true,next_before:id});
  assert.equal(supportMessageWindow({messages:[{id}],message_count:1}).has_older,false);
  const oldest={history_before:id,messages:[],has_older:false,next_before:null};
  assert.equal(supportMessageWindow(oldest),oldest);
  assert.equal(supportMessageWindow(null),null);
});
test('history links preserve member conversation while replacing the cursor',()=>{
  assert.equal(supportHistoryHref('/app/support?conversation=member',id),`/app/support?conversation=member&before=${id}`);
  assert.equal(supportHistoryHref(`/app/support?conversation=member&before=${id}`),'/app/support?conversation=member');
});
test('assignment repair replaces exactly four guest command predicates',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/084_guest_support_assignment_denial.sql',import.meta.url),'utf8');
  const names=[...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map(match=>match[1]);
  assert.deepEqual(names,['managed_guest_support_conversation','send_managed_guest_support_message','close_managed_guest_support','managed_guest_support_attachment_file']);
  assert.equal((sql.match(/assigned_agent_user_id is distinct from actor.id/g)||[]).length,4);
});
