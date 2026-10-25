import {test,expect} from './browser-test';
import type {Page,Route} from 'playwright-core';
import {localAuditService,checked,auditProvider,auditAssignAndPublishSelfDrivenVehicle,auditDeleteVehicles} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {createProviderVehicle} from '../../src/lib/fleet.js';

// Tokens/codes stay inside the isolated browser and local inbox, never traces.
test.use({trace:'off',screenshot:'off'});
test('mobile permission return and transient account refresh keep the authenticated workspace',async({page}:{page:Page})=>{
 test.setTimeout(120000);
 page.setDefaultTimeout(15000);
 const service=localAuditService(),actor=await auditProvider(service,'native-session');
 const privateFullName=checked(await service.from('profiles').select('full_name').eq('id',actor.id).single()).full_name;
 let vehicle='',refreshUnavailable=false,failedRefreshes=0;
 const navigation:string[]=[],authReads:string[]=[];
 page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigation.push(new URL(frame.url()).pathname);});
 page.on('response',response=>{const path=new URL(response.url()).pathname;if(path==='/api/mobile/auth/refresh')authReads.push(`${response.status()}`);});
 try{
  vehicle=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'Demo',model:'Session recovery',plate:`NS-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
  await auditAssignAndPublishSelfDrivenVehicle(service,actor,vehicle);
  await page.goto('http://localhost:8084/account');
  await page.getByLabel('Email',{exact:true}).fill(actor.email);
  const since=Date.now();
  const codeRequest=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/auth/request'&&response.request().method()==='POST',{timeout:30000});
  await page.getByRole('button',{name:'Send code',exact:true}).click();
  expect((await codeRequest).status()).toBe(200);
  await page.getByLabel('Sign-in code',{exact:true}).fill(await localMailpitNumericCode(actor.email,since,'Your Loadgistic sign-in code'));
  await page.getByRole('button',{name:'Sign in',exact:true}).last().click();
  await expect(page.getByRole('button',{name:'Home',exact:true})).toBeVisible({timeout:30000});
  await page.evaluate(()=>{
   const w=window as Window&{__lgRefreshCount?:number};w.__lgRefreshCount=0;
   const fetch=window.fetch.bind(window);
   window.fetch=(input,init)=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;if(url.includes('/api/mobile/auth/refresh'))w.__lgRefreshCount=(w.__lgRefreshCount||0)+1;return fetch(input,init);};
   for(const value of ['hidden','visible']){Object.defineProperty(document,'visibilityState',{configurable:true,value});document.dispatchEvent(new Event('visibilitychange'));}
  });
  expect(await page.evaluate(()=>(window as Window&{__lgRefreshCount?:number}).__lgRefreshCount)).toBe(0);
  await expect(page.getByRole('button',{name:'Home',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Account',exact:true}).click();
  await expect(page).toHaveURL(/\/account-settings$/,{timeout:30000});
  await expect(page.getByRole('button',{name:'Account details',exact:true})).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'Account details',exact:true}).click();
  await page.getByRole('button',{name:'Edit account details',exact:true}).click();
  await expect(page.getByLabel('First name',{exact:true})).toBeVisible();await expect(page.getByLabel('Last / father name',{exact:true})).toHaveValue('');
  await page.route('**/api/mobile/auth/refresh',(route:Route)=>{if(refreshUnavailable){failedRefreshes++;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'This service is temporarily unavailable. Please try again.'}})});}return route.continue();});
  refreshUnavailable=true;await page.getByLabel('First name',{exact:true}).fill('Native session recovery');
  const savedResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/account'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  expect((await savedResponse).status()).toBe(200);
  await expect.poll(()=>failedRefreshes).toBe(1);
  expect(new URL(page.url()).pathname,`account navigation ${navigation.join(' > ')}; refresh statuses ${authReads.join(',')}`).toBe('/account-settings');
  await expect(page.getByText('Account details saved.',{exact:true})).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'Back to account',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Send code',exact:true})).toHaveCount(0);
  const stored=checked(await service.from('profiles').select('first_name,full_name').eq('id',actor.id).single());expect(stored.first_name).toBe('Native session recovery');expect(stored.full_name).toBe(privateFullName);
  refreshUnavailable=false;await page.getByRole('button',{name:'Account details',exact:true}).click();
  await page.getByRole('button',{name:'Edit account details',exact:true}).click();
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByText('Account details saved.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back to account',exact:true}).click();
  await page.getByRole('tab',{name:'Home',exact:true}).click();
  await expect(page.getByRole('button',{name:'Home',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Account',exact:true}).click();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('button',{name:'Send code',exact:true})).toBeVisible();
 }finally{
  if(!page.isClosed())await page.unroute('**/api/mobile/auth/refresh');
  if(vehicle){checked(await service.from('audit_logs').delete().eq('entity_id',vehicle));checked(await auditDeleteVehicles(service,'id',vehicle));}
  checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));
 }
});
