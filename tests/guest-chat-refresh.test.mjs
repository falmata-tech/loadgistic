import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guestChatRefreshDelay as delay} from '../src/lib/guest-chat-refresh.js';

test('chat polling only runs for visible enabled work and slows minimized conversations',()=>{
  const active={visible:true,enabled:true,open:true,status:'OPEN'};
  assert.equal(delay(active),2000);
  assert.equal(delay({...active,open:false}),10000);
  for(const override of [{visible:false},{enabled:false},{status:'CLOSED'},{status:null,open:false}])assert.equal(delay({...active,...override}),null);
  assert.equal(delay({...active,status:null}),30000);
});

test('current-chat read distinguishes missing access from a database outage',()=>{
  const route=readFileSync(new URL('../src/app/api/guest-support/current/route.ts',import.meta.url),'utf8');
  assert.match(route,/error\.message==='NOT_FOUND'/);
  assert.match(route,/status:503/);
});
