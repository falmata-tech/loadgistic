import test from 'node:test';
import assert from 'node:assert/strict';
import {teamQueuePath,teamQueueReturnPath,teamConversationHref} from '../src/lib/team-navigation.js';
const id='11111111-1111-4111-8111-111111111111';
test('queue context preserves the exact allowed service, role, view and bounded page',()=>{
  for(const [service,role,options] of [
    ['support','ADMIN',{view:'WAITING',page:4}],['support','SUPPORT',{view:'CLOSED',page:2}]
  ]){const path=teamQueuePath(service,role,options);assert.equal(teamQueueReturnPath(path,service,role),path);assert.equal(new URL(teamConversationHref(service,id,path),'https://team.invalid').searchParams.get('returnTo'),path);}
});
test('retired queue links cannot reopen Brokerage or grant software Support',()=>{
  for(const role of ['ADMIN','SUPPORT']){
    assert.equal(teamQueuePath('brokerage',role,{queue:'ALL'}),'/app/more');
    assert.equal(teamQueueReturnPath('/brokerage?queue=ALL','brokerage',role),'/app/more');
    assert.throws(()=>teamConversationHref('brokerage',id,'/brokerage'),/PLATFORM_BROKERAGE_RETIRED/);
  }
});
test('untrusted return context cannot change role, service, origin or route',()=>{
  for(const [service,role] of [['support','ADMIN'],['support','SUPPORT'],['brokerage','ADMIN'],['brokerage','SUPPORT']]){
    const fallback=teamQueuePath(service,role);
    for(const value of ['https://example.test/support','//example.test/support','/\\example.test','/support/../admin','/support%2f..%2fadmin','/support\n','/brokerage?queue=ALL&queue=MINE','/brokerage?view=ALL&next=https://example.test','/support#private','/support?page=0','/support?page=1.5','/support?page=1000001','/admin/support?tab=team','/admin/support?tab=history'])assert.equal(teamQueueReturnPath(value,service,role),fallback);
  }
  assert.equal(teamQueueReturnPath('/brokerage?queue=ALL&view=ALL','brokerage','SUPPORT'),teamQueuePath('brokerage','SUPPORT'));
  assert.equal(teamQueueReturnPath('/admin/support?tab=chats&view=ALL','support','SUPPORT'),teamQueuePath('support','SUPPORT'));
  assert.throws(()=>teamConversationHref('support','../admin','/support'),/INVALID_TEAM_CONVERSATION/);
});
