import test from 'node:test';
import assert from 'node:assert/strict';
import {featuredTikTokPresentation} from '../src/lib/featured-tiktok-presentation.js';

test('Featured clearly distinguishes TikTok broadcast state from the vehicle timetable',()=>{
  assert.deepEqual(featuredTikTokPresentation('LIVE',true),{state:'live',message:'TikTok LIVE broadcast is on now',action:'Watch live on TikTok'});
  assert.deepEqual(featuredTikTokPresentation('SCHEDULED',true),{state:'scheduled',message:'TikTok LIVE broadcast planned · {time} EAT',action:'View on TikTok'});
  assert.deepEqual(featuredTikTokPresentation('ENDED',true),{state:'ended',message:'TikTok LIVE broadcast ended today',action:'View on TikTok'});
  assert.deepEqual(featuredTikTokPresentation('LIVE',false),{state:'not-scheduled',message:'No TikTok LIVE broadcast planned today',action:null});
  assert.deepEqual(featuredTikTokPresentation('UNKNOWN',true),{state:'not-scheduled',message:'No TikTok LIVE broadcast planned today',action:null});
});
