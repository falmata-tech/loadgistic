import test from 'node:test';
import assert from 'node:assert/strict';
import {featuredTikTokPresentation} from '../src/lib/featured-tiktok-presentation.js';

test('public Featured shows only a confirmed broadcast with a safe TikTok link and time',()=>{
  const url='https://www.tiktok.com/@loadgistic/live';
  assert.deepEqual(featuredTikTokPresentation('LIVE',url,'08:30'),{state:'live',message:'TikTok LIVE broadcast is on now',action:'Watch live on TikTok',href:url,showPublic:true});
  assert.deepEqual(featuredTikTokPresentation('SCHEDULED',url,'08:30'),{state:'scheduled',message:'TikTok LIVE broadcast planned · {time} EAT',action:'View on TikTok',href:url,showPublic:true});
  for(const status of ['NOT_SCHEDULED','ENDED','UNKNOWN'])assert.equal(featuredTikTokPresentation(status,url,'08:30').showPublic,false,status);
  for(const invalid of ['', 'http://www.tiktok.com/@loadgistic/live','https://tiktok.com.evil.test/live','https://user:pass@tiktok.com/live','javascript:alert(1)'])
    assert.equal(featuredTikTokPresentation('LIVE',invalid,'08:30').showPublic,false,invalid);
  for(const time of ['', '8:30','25:00','08:99'])assert.equal(featuredTikTokPresentation('SCHEDULED',url,time).showPublic,false,time);
  assert.equal(featuredTikTokPresentation('LIVE',url,'').showPublic,false,'a Live badge also needs a valid configured time');
});

test('admin state remains exact even when public broadcast presentation is hidden',()=>{
  const url='https://www.tiktok.com/@loadgistic/live';
  assert.deepEqual(featuredTikTokPresentation('NOT_SCHEDULED',url,'08:30'),{state:'not-scheduled',message:'Not scheduled',action:null,href:null,showPublic:false});
  assert.deepEqual(featuredTikTokPresentation('ENDED',url,'08:30'),{state:'ended',message:'Ended',action:null,href:null,showPublic:false});
  assert.equal(featuredTikTokPresentation('LIVE','', '08:30').state,'live');
  assert.equal(featuredTikTokPresentation('SCHEDULED','', '08:30').state,'scheduled');
});
