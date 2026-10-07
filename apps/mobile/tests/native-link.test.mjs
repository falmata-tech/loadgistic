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
 for(const route of ['/','/featured','/about','/visitor-tracking','/arrange-transport']){
  assert.equal(normalize(route),route);assert.equal(routes.get(route),'(marketplace)');
 }
 for(const route of ['/account','/account-settings','/fleet','/manage-capacity','/shipments','/network','/support','/documents','/profile','/billing']){
  assert.equal(normalize(route),route);assert.equal(routes.get(route),'(workspace)');
 }
 const id='e5df8dc7-76cc-4c33-a5b4-bb09b221ddbd';
 for(const route of ['/shipment-detail','/shipment-manage','/support-chat','/visitor-shipment']){
  assert.equal(normalize(`${route}?id=${id}`),`${route}?id=${id}`);assert.ok(routes.has(route));
 }
 assert.equal(routes.has('/admin'),false);assert.equal(routes.has('/staff'),false);
});
