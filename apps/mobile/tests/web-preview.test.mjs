import test from 'node:test';
import assert from 'node:assert/strict';
import proxy from '../scripts/local-preview-proxy.cjs';
import {getItemAsync,setItemAsync,deleteItemAsync} from '../src/session/storage.web.ts';

test('local preview proxy only handles native API and public asset paths',()=>{
 for(const path of ['/api/mobile/session','/api/mobile/auth/request','/api/public/capacity?q=city','/vehicle-configurations/truck.jpg','/marketing/profile.png'])assert.equal(proxy.allowedPath(path),true);
 for(const path of ['/api/admin/settings','/api/company-page','https://evil.example/api/mobile/session','//evil.example/api/mobile/session','/admin','/.env.local','/api/mobile/../admin/settings','/api/mobile/%2e%2e/admin/settings','/api/mobile/%5cadmin','/api/mobile/%ZZ'])assert.equal(proxy.allowedPath(path),false);
 let status,ended=false;
 proxy.localPreviewProxy(()=>assert.fail('must deny'))({url:'/api/mobile/session',headers:{host:'evil.example'}},{writeHead:code=>{status=code;},end:()=>{ended=true;}});
 assert.equal(status,403);assert.equal(ended,true);
});

test('local preview forwards only exact provider and business cargo-photo paths',()=>{
 const id='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222';
 const provider='/api/capacity/cargo-space-photos',business=`/api/business-workspaces/${workspace}/capacity`;
 for(const path of [
  provider,`${provider}?vehicleId=${id}`,`${provider}/${id}?format=base64`,
  `${business}/photos?vehicleId=${id}`,`${business}/photos/${id}`,`${business}/photos/${id}?format=base64`,`${business}/photo-requests`
 ])assert.equal(proxy.allowedPath(path),true,`should forward ${path}`);
 for(const path of [
  `${provider}?vehicleId=not-an-id`,`${provider}?vehicleId=${id}&vehicleId=${id}`,`${provider}?format=base64`,
  `${provider}/${id}`,`${provider}/${id}?format=raw`,`${provider}/${id}?format=base64&other=1`,
  `${provider}/%2e%2e/admin`,`${provider}/../admin`,`${provider}/${id}/extra?format=base64`,
  `${business}/photos?vehicleId=not-an-id`,`${business}/photos?vehicleId=${id}&other=1`,
  `${business}/photos/${id}?format=raw`,`${business}/photo-requests?vehicleId=${id}`,
  `/api/business-workspaces/not-an-id/capacity/photos?vehicleId=${id}`,
  `https://evil.example${provider}`,`//evil.example${provider}`
 ])assert.equal(proxy.allowedPath(path),false,`should reject ${path}`);
});

test('web preview uses tab storage and rejects hosted or production session persistence',async()=>{
 const originalWindow=globalThis.window,originalDev=globalThis.__DEV__;
 const values=new Map();
 try{
  globalThis.__DEV__=true;
  globalThis.window={location:{hostname:'localhost'},sessionStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}};
  await setItemAsync('session','opaque-test-value');assert.equal(await getItemAsync('session'),'opaque-test-value');await deleteItemAsync('session');assert.equal(await getItemAsync('session'),null);
  globalThis.window.location.hostname='loadgistic.com';await assert.rejects(setItemAsync('session','value'),/local only/);
  globalThis.window.location.hostname='localhost';globalThis.__DEV__=false;await assert.rejects(getItemAsync('session'),/local only/);
  delete globalThis.window;assert.equal(await getItemAsync('session'),null);
 }finally{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;if(originalDev===undefined)delete globalThis.__DEV__;else globalThis.__DEV__=originalDev;}
});
