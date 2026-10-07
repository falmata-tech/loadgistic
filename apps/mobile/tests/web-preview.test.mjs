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
