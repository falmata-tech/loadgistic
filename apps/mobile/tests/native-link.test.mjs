import test from 'node:test';
import assert from 'node:assert/strict';
import queryString from 'query-string';
import { normalizeNativeLink as normalize } from '../src/navigation/native-link.ts';

test('known public and protected destinations preserve identifiers without granting sessions', () => {
  const id='e5df8dc7-76cc-4c33-a5b4-bb09b221ddbd';
  for (const prefix of ['', 'loadgistic://', 'https://loadgistic.com', 'https://www.loadgistic.com']) {
    const route=prefix==='loadgistic://'?'transporter':'/transporter';
    assert.equal(normalize(prefix+route+'?handle=rift-valley'), '/transporter?handle=rift-valley');
  }
  for (const route of ['shipment-detail','shipment-manage','visitor-shipment','support-chat']) assert.equal(normalize(`loadgistic://${route}?id=${id}`),`/${route}?id=${id}`);
  assert.equal(normalize('loadgistic:///account'),'/account');
});
test('the website Tracking entry opens native email verification without trusting link credentials',()=>{
 for(const path of ['/track','/track/','https://loadgistic.com/track','https://www.loadgistic.com/track','loadgistic://track']){
  assert.equal(normalize(path),'/visitor-tracking');
 }
 for(const path of ['/track?email=person@example.test','/track?code=123456','/track#token=secret','https://evil.example/track']){
  assert.equal(normalize(path),'/link-unavailable');
 }
});
test('business invitation entry opens only the bounded workspaces route',()=>{
 for(const path of ['/workspaces','/workspaces/','https://loadgistic.com/workspaces','https://www.loadgistic.com/workspaces','loadgistic://workspaces','loadgistic:///workspaces'])
  assert.equal(normalize(path),'/workspaces',path);
 for(const path of ['https://evil.example/workspaces','http://loadgistic.com/workspaces','https://user:password@loadgistic.com/workspaces',
  '/workspaces?email=someone@example.test','/workspaces?invitationId=private','/workspaces?token=secret','/workspaces?redirect=/account',
  '/workspaces#secret','loadgistic://workspaces?code=123456'])assert.equal(normalize(path),'/link-unavailable');
});
test('canonical private-capacity and public-profile aliases retain the normal privacy boundary',()=>{
 for(const prefix of ['', 'https://loadgistic.com', 'https://www.loadgistic.com']){
  assert.equal(normalize(prefix+'/shared-capacity'),'/?view=private');
  assert.equal(normalize(prefix+'/@rift-valley'),'/transporter?handle=rift-valley');
 }
 assert.equal(normalize('loadgistic://shared-capacity'),'/?view=private');
 assert.equal(normalize('/?view=private&q=Adama'),'/?view=private&q=Adama');
 for(const path of ['/shared-capacity?email=person@example.test','/@rift-valley?token=secret','/@x',
  '/?view=private&view=private','/?view=private&code=123456','/?view=unknown','https://evil.example/shared-capacity'])
  assert.equal(normalize(path),'/link-unavailable');
});
test('malformed, ambiguous, foreign and credential-bearing links recover without echoing input', () => {
  for (const path of ['//evil.example/account','https://evil.example/account','http://loadgistic.com/account',
    'https://user:password@loadgistic.com/account','loadgistic://account?token=secret',
    '/transporter?handle=one&handle=two','/account#token=secret','/account?redirect=/fleet',
    '/transporter?handle=%','/?q=%C0%AF','/?q=%E0%A4','/?q=%00','/admin','/shipment-detail?id=bad',
    '/?q='+ 'a'.repeat(121), '/?q='+ '%FF'.repeat(700), '/\\evil.example','/account\n',
    '/?q=x&id=y','/transporter?handle=x%2526token%253Devil']) assert.equal(normalize(path),'/link-unavailable');
});
test('canonical relative query reaches installed parser without a double decode or injected parameter', () => {
  for (const value of ['Adama','አዳማ','100%','%FF'.repeat(30),'name&token=not-a-token','a+b']) {
    const safe=normalize('loadgistic:///?q='+encodeURIComponent(value));
    assert.ok(safe.startsWith('/?q='));
    assert.deepEqual({...queryString.parse(safe.slice(2))},{q:value});
  }
});
test('development launcher permits loopback Metro only and cannot bypass production boundary', () => {
  const path='exp+loadgistic://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8083';
  assert.equal(normalize(path,true),'/');assert.equal(normalize(path,false),'/link-unavailable');
  assert.equal(normalize(path.replace('127.0.0.1','evil.example'),true),'/link-unavailable');
  assert.equal(normalize(path+'&token=secret',true),'/link-unavailable');
});

test('area grouping preserves existing public and provider deep-link destinations',async()=>{
 const {readdirSync}=await import('node:fs');
 const routes=new Map();
 for(const group of ['(marketplace)','(workspace)']){
  for(const file of readdirSync(new URL(`../src/app/${group}/`,import.meta.url)).filter(file=>!file.startsWith('_'))){
   const route=file==='index.tsx'?'/':'/'+file.replace(/\.tsx$/,'');
   assert.ok(!routes.has(route),`Ambiguous deep link ${route}`);routes.set(route,group);
  }
 }
 for(const route of ['/','/featured','/about','/visitor-tracking']){
  assert.equal(normalize(route),route);assert.equal(routes.get(route),'(marketplace)');
 }
 for(const route of ['/account','/account-settings','/fleet','/manage-capacity','/shipments','/network','/support','/documents','/profile','/billing']){
  assert.equal(normalize(route),route);assert.equal(routes.get(route),'(workspace)');
 }
 assert.equal(normalize('/workspaces'),'/workspaces');assert.equal(routes.get('/workspaces'),'(workspace)');
 const id='e5df8dc7-76cc-4c33-a5b4-bb09b221ddbd';
 for(const route of ['/shipment-detail','/shipment-manage','/support-chat','/visitor-shipment']){
  assert.equal(normalize(`${route}?id=${id}`),`${route}?id=${id}`);assert.ok(routes.has(route));
 }
 assert.equal(normalize('/arrange-transport'),'/link-unavailable');
 assert.equal(routes.has('/admin'),false);assert.equal(routes.has('/staff'),false);
});

test('explicit profile map links preserve bounded identities without sharing private credentials',()=>{
 const id='e5df8dc7-76cc-4c33-a5b4-bb09b221ddbd';
 assert.equal(normalize('https://loadgistic.com/?provider=rift-valley'),'/?provider=rift-valley');
 assert.equal(normalize('/?provider=rift-valley&truck='+id),'/?provider=rift-valley&truck='+id);
 assert.equal(normalize('/?view=private&provider=rift-valley'),'/?view=private&provider=rift-valley');
 for(const query of ['provider=bad%20handle','provider=','provider=one&provider=two','truck=invalid','provider=rift-valley&email=private@example.test'])assert.equal(normalize('/?'+query),'/link-unavailable');
});
