import {chooseTruckConfiguration} from './capacity-drawer-helper';
import {test,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});
import type {Page} from 'playwright-core';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {localAuditService,checked} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {openCapacityFilters,openCapacityFilterDialog} from './capacity-drawer-helper';
import {grantPrivateCapacityAccess,listPrivateCapacityNetwork,revokePrivateCapacityAccess} from '../../src/lib/private-capacity.js';
const choice=(page:Page)=>page.getByRole('navigation',{name:'Capacity views',exact:true});

test('one Capacity menu opens public by default and a locked private map contains no signals',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);
 await page.goto('/');await expect(page.locator('.language-picker select:visible')).toBeEnabled();
 await expect(choice(page).getByRole('link',{name:'Open to the public',exact:true})).toHaveAttribute('aria-current','page');
 const nav=page.locator('.public-workspace-nav:visible,.public-mobile-nav:visible');
 await expect(nav.getByRole('link',{name:'Capacity',exact:true})).toHaveCount(1);
 await expect(nav.getByRole('link',{name:/^Private/})).toHaveCount(0);
 for(const label of ['Track','Featured','About'])await expect(nav.getByRole('link',{name:label,exact:true})).toHaveCount(1);
 await page.screenshot({path:info.outputPath('open-map.png')});
 const requested:string[]=[];
 await choice(page).getByRole('link',{name:'Privately shared with you',exact:true}).click();
 await expect(page.locator('.locked-capacity-map .leaflet-container')).toBeVisible();
 page.on('request',request=>{const path=new URL(request.url()).pathname;if(['/api/public/capacity','/api/shared-capacity'].includes(path))requested.push(path);});
 await expect(page.locator('.locked-capacity-map .leaflet-marker-icon')).toHaveCount(0);
 await expect(choice(page).getByRole('link',{name:'Privately shared with you',exact:true})).toHaveAttribute('aria-current','page');
 expect((await page.request.get('/api/shared-capacity')).status()).toBe(401);
 await page.locator('.locked-capacity-map .leaflet-control-zoom-in').click();
 await page.locator('.locked-capacity-map .leaflet-control-zoom-out').click();
 await page.getByLabel('Email',{exact:true}).fill(`no-share-${randomUUID()}@example.test`);
 await page.getByRole('button',{name:'Continue with email',exact:true}).click();
 await expect(page.locator('.shared-capacity-access-card .form-notice')).toBeVisible();
 await expect(page.getByLabel('6-digit email code')).toHaveCount(0);expect(requested).toEqual([]);
 await page.screenshot({path:info.outputPath('private-empty.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/shared-capacity?vehicleCategory=Cargo+van');
 await expect(page).toHaveURL(/\/\?.*view=private/);expect(new URL(page.url()).searchParams.get('vehicleCategory')).toBe('Cargo van');
 await expect(page.locator('.locked-capacity-map')).toBeVisible();
});

test('private email code unlocks only its grants and retains private scope through clearing and logout',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(180000);const db=localAuditService();const suffix=randomUUID();
 const capacity=checked(await db.from('capacities').select('id,vehicle_id,provider_organization_id').eq('visibility','PRIVATE').not('provider_organization_id','is',null).limit(1).single());
 const membership=checked(await db.from('organization_members').select('user_id').eq('organization_id',capacity.provider_organization_id).eq('membership_role','OWNER').single());
 const actor=checked(await db.from('profiles').select('id,role').eq('id',membership.user_id).single());
 const network=await listPrivateCapacityNetwork(actor),other=network.find((v:{id:string})=>v.id!==capacity.vehicle_id);
 expect(other).toBeTruthy();const email=`unified-${suffix}@example.test`,otherEmail=`other-${suffix}@example.test`;
 const grant=await grantPrivateCapacityAccess(actor,{vehicleId:capacity.vehicle_id,email});
 const otherGrant=await grantPrivateCapacityAccess(actor,{vehicleId:other.id,email:otherEmail});
 try{
  await page.goto('/?view=private');await expect(page.locator('.language-picker select:visible')).toBeEnabled();
  await page.getByLabel('Email',{exact:true}).fill(email);const since=Date.now();
  await page.getByRole('button',{name:'Continue with email',exact:true}).click();
  await expect(page.getByLabel('6-digit email code')).toBeVisible();
  expect((await page.request.get('/api/shared-capacity')).status()).toBe(401);
  await page.screenshot({path:info.outputPath('private-code.png')});
  const code=await localMailpitNumericCode(email,since,'Your Private capacity code');
  await page.getByLabel('6-digit email code').fill(code==='000000'?'111111':'000000');
  await page.getByRole('button',{name:'View shared signals',exact:true}).click();
  await expect(page.locator('.shared-capacity-access-card .form-error')).toContainText('could not be verified');
  await page.getByLabel('6-digit email code').fill(code);
  const verified=page.waitForResponse(r=>r.url().endsWith('/api/shared-capacity/access')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'View shared signals',exact:true}).click();
  const verification=await verified;expect(verification.status()).toBe(200);expect((await verification.json()).ok).toBe(true);
  await expect(page.getByRole('region',{name:'Privately shared truck capacity'})).toBeVisible();
  const response=await page.request.get('/api/shared-capacity');expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toContain('no-store');
  const body=await response.json();expect(body.items.map((v:{id:string})=>v.id)).toEqual([capacity.id]);
  const drawer=await openCapacityFilterDialog(page);await chooseTruckConfiguration(drawer,body.items[0].cargo_configuration);
  await drawer.getByRole('button',{name:'Show matching trucks',exact:true}).click();
  await expect(page).toHaveURL((url:URL)=>url.searchParams.get('view')==='private'&&url.searchParams.has('vehicleCategory'));
  await expect(page.locator('.capacity-drawer-handle button')).toBeEnabled();
  const filtered=await openCapacityFilters(page);await filtered.getByRole('link',{name:'Clear all',exact:true}).click();
  await expect(page).toHaveURL((url:URL)=>url.searchParams.get('view')==='private'&&!url.searchParams.has('vehicleCategory'));
  await expect(page.locator('.capacity-drawer-handle button')).toBeEnabled();
  expect((await (await page.request.get('/api/shared-capacity')).json()).items.map((v:{id:string})=>v.id)).toEqual([capacity.id]);
  await page.screenshot({path:info.outputPath('private-unlocked.png')});
  await choice(page).getByRole('link',{name:'Open to the public',exact:true}).click();
  await expect(page.locator('.shared-capacity-session-workspace')).toHaveCount(0);
  const publicPage=await page.request.get(`/api/public/capacity?truck=${capacity.vehicle_id}`);
  expect((await publicPage.json()).items.some((v:{id:string})=>v.id===capacity.id)).toBe(false);
  await choice(page).getByRole('link',{name:'Privately shared with you',exact:true}).click();
  await expect(page.getByRole('button',{name:'Log out',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Log out',exact:true}).click();
  await expect(page.locator('.locked-capacity-map')).toBeVisible();expect((await page.request.get('/api/shared-capacity')).status()).toBe(401);
  await page.goBack();await page.goBack();
  await expect(page.locator('.shared-capacity-session-workspace')).toHaveCount(0);
  await page.goto('/?view=private');await expect(page.getByRole('button',{name:'Continue with email',exact:true})).toBeVisible();
 }finally{await revokePrivateCapacityAccess(actor,grant.id);await revokePrivateCapacityAccess(actor,otherGrant.id);await page.request.delete('/api/shared-capacity/session').catch(()=>{});}
});

test('combined view choices and locked email map remain readable in all languages',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(120000);if((page.viewportSize()?.width||1280)<500)await page.setViewportSize({width:320,height:720});await page.goto('/?view=private');
 for(const locale of ['am','om','so','ti']){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  await expect(page.locator('.language-picker select:visible')).toBeEnabled();await page.locator('.language-picker select:visible').selectOption(locale);
  await expect(page.locator('.capacity-view-choice a').nth(0)).toHaveText(messages['Open to the public']);
  await expect(page.locator('.capacity-view-choice a').nth(1)).toHaveText(messages['Privately shared with you']);
  await expect(page.locator('.locked-capacity-access h2')).toHaveText(messages['Trucks shared with you']);
  await expect(page.locator('.market-introduction p')).toHaveText(messages['Transporters share capacity, routes and availability with brokers, shippers and receivers on Loadgistic. Explore open signals or view those shared with your email.']);
  await expect(page.locator('.locked-capacity-access h2 + p')).toHaveText(messages['Enter the email a transporter shared with. Verify it with a code to see their capacity, routes and availability. No account needed.']);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.locked-capacity-access').scrollIntoViewIfNeeded();
  const submit=page.locator('.locked-capacity-access form button').first();
  await submit.scrollIntoViewIfNeeded();await expect(submit).toBeInViewport();await submit.click({trial:true});
  await page.screenshot({path:info.outputPath(`private-${locale}.png`)});
 }
 await page.goto('/about');
 for(const locale of ['am','om','so','ti']){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  await expect(page.locator('.language-picker select:visible')).toBeEnabled();await page.locator('.language-picker select:visible').selectOption(locale);
  for(const message of ['Share capacity, routes and availability with brokers, shippers and receivers you know, or make them open to the public.','Explore signals open to the public, view those privately shared with you, or share your own truck availability.'])await expect(page.locator('main')).toContainText(messages[message]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
