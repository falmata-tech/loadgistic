import {chooseTruckConfiguration} from './capacity-drawer-helper';
import {test,expect as baseExpect} from './browser-test';
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
 const grant=await grantPrivateCapacityAccess(actor,{name:'Synthetic recipient',vehicleId:capacity.vehicle_id,email});
 const otherGrant=await grantPrivateCapacityAccess(actor,{name:'Synthetic recipient',vehicleId:other.id,email:otherEmail});
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
  await expect(page.getByRole('region',{name:'Privately shared vehicle capacity'})).toBeVisible();
  const response=await page.request.get('/api/shared-capacity');expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toContain('no-store');
  const body=await response.json();expect(body.items.map((v:{id:string})=>v.id)).toEqual([capacity.id]);
  const drawer=await openCapacityFilterDialog(page);await chooseTruckConfiguration(drawer,body.items[0].cargo_configuration);
  await drawer.getByRole('button',{name:'Show vehicles',exact:true}).click();
  await expect(page).toHaveURL((url:URL)=>url.searchParams.get('view')==='private'&&url.searchParams.has('vehicleCategory'));
  await expect(page.locator('.capacity-drawer-handle button[aria-controls="capacity-filter-drawer"]')).toBeEnabled();
  const filtered=await openCapacityFilterDialog(page);await filtered.getByRole('link',{name:'Clear',exact:true}).click();
  await expect(page).toHaveURL((url:URL)=>url.searchParams.get('view')==='private'&&!url.searchParams.has('vehicleCategory'));
  await expect(page.locator('.capacity-drawer-handle button[aria-controls="capacity-filter-drawer"]')).toBeEnabled();
  expect((await (await page.request.get('/api/shared-capacity')).json()).items.map((v:{id:string})=>v.id)).toEqual([capacity.id]);
  await page.screenshot({path:info.outputPath('private-unlocked.png')});
  await choice(page).getByRole('link',{name:'Open to the public',exact:true}).click();
  await expect(page.locator('.shared-capacity-session-workspace')).toHaveCount(0);
  const publicPage=await page.request.get(`/api/public/capacity?truck=${capacity.vehicle_id}`);
  expect((await publicPage.json()).items.some((v:{id:string})=>v.id===capacity.id)).toBe(false);
  await choice(page).getByRole('link',{name:'Privately shared with you',exact:true}).click();
  await expect(page.getByRole('button',{name:'Log out',exact:true})).toBeVisible();
  await expect(page.locator('.language-picker select:visible')).toBeEnabled();
  const loggedOut=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/shared-capacity/session'&&response.request().method()==='DELETE');
  const logoutNavigation=page.waitForResponse(response=>{const url=new URL(response.url());return response.request().isNavigationRequest()&&response.request().method()==='GET'&&url.pathname==='/'&&url.searchParams.get('view')==='private'&&url.searchParams.get('session')==='logout';});
  await page.getByRole('button',{name:'Log out',exact:true}).click();
  expect((await loggedOut).status()).toBe(200);
  const logoutDocument=await logoutNavigation;expect(logoutDocument.status()).toBe(200);await logoutDocument.finished();
  await expect(page).toHaveURL((url:URL)=>url.pathname==='/'&&url.searchParams.get('view')==='private'&&url.searchParams.get('session')==='logout');
  await expect(page.locator('.locked-capacity-map')).toBeVisible();expect((await page.request.get('/api/shared-capacity')).status()).toBe(401);
  await page.goBack();await page.goBack();
  await expect(page.locator('.shared-capacity-session-workspace')).toHaveCount(0);
  await page.goto('/?view=private');await expect(page.getByRole('button',{name:'Continue with email',exact:true})).toBeVisible();
 }finally{await revokePrivateCapacityAccess(actor,grant.id);await revokePrivateCapacityAccess(actor,otherGrant.id);await page.request.delete('/api/shared-capacity/session').catch(()=>{});}
});

test('combined view choices and locked email map remain readable in all languages',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(120000);if((page.viewportSize()?.width||1280)<500)await page.setViewportSize({width:320,height:720});await page.goto('/?view=private');
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  await expect(page.locator('.language-picker select:visible')).toBeEnabled();await page.locator('.language-picker select:visible').selectOption(locale);
  await expect(page.locator('.capacity-view-choice a').nth(0)).toHaveText(messages['Open to the public']);
  await expect(page.locator('.capacity-view-choice a').nth(1)).toHaveText(messages['Privately shared with you']);
  await expect(page.locator('.locked-capacity-access h2')).toHaveText(messages['Vehicles shared with you']);
  await expect(page.locator('.market-introduction p')).toHaveText(messages['Keep your transporters close. See the space and routes they report, or find new options in the public market.']);
  await expect(page.locator('.locked-capacity-access h2 + p')).toHaveText(messages['Enter the email a transporter shared with. Verify it with a code to see their capacity, routes and availability. No account needed.']);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.locked-capacity-access').scrollIntoViewIfNeeded();
  const submit=page.locator('.locked-capacity-access form button').first();
  await submit.scrollIntoViewIfNeeded();await expect(submit).toBeInViewport();await submit.click({trial:true});
  await page.screenshot({path:info.outputPath(`private-${locale}.png`)});
 }
 await page.goto('/about');
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  await expect(page.locator('.language-picker select:visible')).toBeEnabled();await page.locator('.language-picker select:visible').selectOption(locale);
  await expect(page.getByRole('heading',{level:1})).toHaveText(messages['Put your transport network to work.']);
  const audiences=[
   {label:'Brokers & shippers',heading:'Your regular vehicles, in one view.',facts:['Ask transporters to share with your email. Verify it to see their space, routes and approximate locations together.','Need another vehicle? Filter public capacity, then contact the transporter to confirm the job.','For agreed shipments, follow private progress updates and loading and unloading photos.'],action:'Find capacity',href:'/'},
   {label:'Drivers & owners',heading:'Make your next load easier to find.',facts:['Keep your current vehicle, routes and approximate location up to date.','Share with your contacts, open to the public, do both or choose one recipient.','Submit your documents for review so customers can see what Loadgistic has checked.'],action:'Transporter login',href:'/login'},
   {label:'Transport companies',heading:'Keep your fleet visible to your customers.',facts:['Keep assignments and available space together in your workspace.','Choose which vehicles each broker or customer can see on their private map.','Share private shipment updates, approximate location and proof photos once the work is agreed.'],action:'Transporter login',href:'/login'},
  ];
  for(const audience of audiences){
   const tab=page.getByRole('tab',{name:messages[audience.label],exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');
   const panel=page.getByRole('tabpanel',{name:messages[audience.label],exact:true});await expect(panel).toBeVisible();await expect(panel.getByRole('heading',{level:2})).toHaveText(messages[audience.heading]);
   for(const message of audience.facts)await expect(panel).toContainText(messages[message]);
   await expect(panel.getByRole('link',{name:messages[audience.action],exact:true})).toHaveAttribute('href',audience.href);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
