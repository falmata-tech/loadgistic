import test from 'node:test';
import assert from 'node:assert/strict';
import {contentSecurityPolicy} from '../src/lib/security-headers.js';
import nextConfig from '../next.config.mjs';
import {youtubeCoverId} from '../src/lib/provider-cover-video.js';
import {providerProfileCommand} from '../src/lib/provider-profile/supabase.js';
import {nativePublicProvider} from '../src/lib/mobile/public-contract.js';

test('owners can set and remove their cover without changing unrelated profile fields',()=>{
  for(const url of ['https://youtu.be/pY4J8xn2Gdc?t=8','https://www.youtube.com/watch?v=pY4J8xn2Gdc','https://m.youtube.com/shorts/pY4J8xn2Gdc']){
    assert.deepEqual(providerProfileCommand({coverVideoUrl:url}),{cover_video_id:'pY4J8xn2Gdc'});
  }
  assert.deepEqual(providerProfileCommand({coverVideoUrl:''}),{cover_video_id:null});
  assert.deepEqual(providerProfileCommand({}),{});
  for(const value of ['https://example.com/watch?v=pY4J8xn2Gdc','https://youtube.com/playlist?list=some-list','http://youtu.be/pY4J8xn2Gdc','https://youtu.be/bad']){
    assert.throws(()=>youtubeCoverId(value),/INVALID_COVER_VIDEO/);
  }
});
test('independent owners explicitly publish a cover while historical private media stays hidden',()=>{
  const legacy={name:'Example',handle:'example',provider_kind:'SELF_MANAGED_DRIVER',youtube_video_id:'oldhidden01'};
  assert.equal(nativePublicProvider(legacy).youtubeId,'');
  assert.equal(nativePublicProvider({...legacy,cover_video_id:'pY4J8xn2Gdc'}).youtubeId,'pY4J8xn2Gdc');
  assert.equal(nativePublicProvider({...legacy,provider_kind:'FLEET_TRANSPORTER',cover_video_id:null}).youtubeId,'');
});

test('only public provider routes permit the private-mode YouTube player and thumbnail origin',async()=>{
  const headers=await nextConfig.headers();
  const targets=headers.filter(rule=>rule.headers.some(h=>h.key==='Content-Security-Policy'&&h.value.includes('youtube-nocookie.com')));
  assert.deepEqual(targets.map(rule=>rule.source),['/@:handle','/providers/:handle']);
  assert.doesNotMatch(contentSecurityPolicy(),/youtube|ytimg/);
  const policy=contentSecurityPolicy({}, {providerCover:true});
  assert.match(policy,/frame-src 'self' https:\/\/www\.youtube-nocookie\.com;/);
  assert.match(policy,/connect-src 'self';/);
  assert.match(policy,/frame-ancestors 'none';/);
});
