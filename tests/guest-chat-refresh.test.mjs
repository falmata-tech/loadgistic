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

test('retired public help returns Gone without reopening a guest conversation',()=>{
  const route=readFileSync(new URL('../src/app/api/guest-support/current/route.ts',import.meta.url),'utf8');
  assert.match(route,/PUBLIC_SUPPORT_CLOSED_MESSAGE/);
  assert.match(route,/status:410/);
  assert.match(route,/'Cache-Control':'no-store'/);
  assert.doesNotMatch(route,/getGuestSupport|createGuestSupport/);
});
