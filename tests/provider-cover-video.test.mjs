import test from 'node:test';
import assert from 'node:assert/strict';
import {contentSecurityPolicy} from '../src/lib/security-headers.js';
import nextConfig from '../next.config.mjs';
import {coverEmbedUrl,coverPlayerOrigin,coverPlayerResult,coverPlayerTimeoutMs,observeCoverPlayer,youtubeCoverId} from '../src/lib/provider-cover-video.js';
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

test('cover playback uses a fixed inline embed and cannot accept a URL or markup as an identifier',()=>{
  assert.equal(coverEmbedUrl('yEJMXHO8rt4','https://loadgistic.example'),'https://www.youtube-nocookie.com/embed/yEJMXHO8rt4?autoplay=1&playsinline=1&enablejsapi=1&origin=https%3A%2F%2Floadgistic.example');
  for(const value of ['','https://youtu.be/yEJMXHO8rt4','yEJMXHO8rt4?x=y','<script>']){
    assert.equal(coverEmbedUrl(value),null);
  }
});

test('cover readiness tracks playable states and ignores loading, malformed and unsolicited messages',()=>{
  for(const message of [{event:'onReady'},{event:'onStateChange',info:3},{event:'initialDelivery',info:{playerState:-1}},
    {event:'other',info:1},{event:'onStateChange',info:'1'}]){
    assert.equal(coverPlayerResult(JSON.stringify(message)),null);
  }
  assert.equal(coverPlayerResult('{'),null);
  assert.equal(coverPlayerResult('x'.repeat(65_537)),null);
  assert.equal(coverPlayerResult('{"event":"onStateChange","info":1}'),'ready');
  assert.equal(coverPlayerResult('{"event":"onAutoplayBlocked"}'),'ready');
  assert.equal(coverPlayerResult('{"event":"onError","info":153}'),'failed');

  let receive,expire;
  const delivered=[],destinations=[];
  const player={postMessage(_message,origin){destinations.push(origin);}};
  const parent={
    addEventListener(_name,listener){receive=listener;},removeEventListener(){receive=null;},
    setInterval(){return 1;},clearInterval(){},
    setTimeout(callback,ms){assert.equal(ms,coverPlayerTimeoutMs);expire=callback;return 2;},clearTimeout(){}
  };
  const frame={contentWindow:player,ownerDocument:{defaultView:parent}};
  const dispose=observeCoverPlayer(frame,status=>delivered.push(status));
  const playing='{"event":"onStateChange","info":1}';
  receive({origin:'https://outside.example',source:player,data:playing});
  receive({origin:coverPlayerOrigin,source:{},data:playing});
  assert.deepEqual(delivered,[]);
  expire();
  receive({origin:coverPlayerOrigin,source:player,data:playing});
  assert.deepEqual(delivered,['failed']);
  assert.ok(destinations.length>0&&destinations.every(origin=>origin===coverPlayerOrigin));
  dispose();
  assert.equal(receive,null);
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
