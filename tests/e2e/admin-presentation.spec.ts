import {expect,test} from './browser-test';
import {auditLogin} from './audit-helpers';
import type {Page} from 'playwright-core';
async function capture(page:Page,info:{outputPath:(name:string)=>string},name:string){
 await page.evaluate(()=>window.scrollTo(0,0));await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
 await page.screenshot({path:info.outputPath(name),fullPage:true});
}

test('admin record actions and connected details remain usable at desktop and narrow phone widths',async({page},info)=>{
 test.setTimeout(240000);await auditLogin(page,'admin@loadgistic.local');
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});await page.goto('/admin');
  const overview=page.locator('.admin-overview-page');await expect(overview.getByRole('heading',{name:'Platform overview',exact:true})).toBeVisible();
  for(const label of ['People and provider accounts','Vehicles','Drivers','Tracking','Capacity','Routes'])await expect(overview.getByRole('link',{name:new RegExp('^'+label)})).toBeVisible();
  await capture(page,info,`admin-overview-${width}.png`);
  await page.goto('/admin/operations?view=DRIVERS');const row=page.locator('.admin-record-list article').first();await expect(row).toBeVisible();
  const actions=row.locator('[class*=rowActions]');await expect(actions.getByRole('link',{name:'Open',exact:true})).toBeVisible();
  for(const button of await actions.locator('a.button,summary.button,form > button').all()){
   if(!await button.isVisible())continue;
   const box=await button.boundingBox();if(!box)continue;expect(box.width).toBeGreaterThanOrEqual(43);expect(box.height).toBeGreaterThanOrEqual(43);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await capture(page,info,`admin-driver-actions-${width}.png`);
  await actions.getByRole('link',{name:'Open',exact:true}).click();await expect(page).toHaveURL(/\/admin\/operations\/drivers\//,{timeout:30000});await expect(page.locator('.admin-operation-record-card')).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'Edit permissions',exact:true}).click();
  const permissions=page.getByRole('dialog',{name:'Driver permissions',exact:true});
  await expect(permissions.getByLabel('Capacity updates')).toBeVisible();await expect(permissions.getByLabel('Tracking updates')).toBeVisible();
  await expect(permissions.getByRole('button',{name:'Save permissions',exact:true})).toBeVisible();
  await permissions.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('button',{name:'Suspend Driver',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Edit permissions',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await capture(page,info,`admin-driver-detail-${width}.png`);
 }
 await page.goto('/admin/operations?view=DRIVERS');
 for(const locale of ['am','om']){
  const picker=page.locator('.app-topbar .language-picker select');await picker.selectOption(locale);await expect(picker).toHaveValue(locale);
  const actions=page.locator('.admin-record-list article').first().locator('[class*=rowActions]');await expect(actions).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const button of await actions.locator('a.button,summary.button,form > button').all()){
   if(!await button.isVisible())continue;
   const box=await button.boundingBox();if(!box)continue;expect(box.height).toBeGreaterThanOrEqual(43);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(321);
  }
  await capture(page,info,`admin-driver-actions-${locale}-320.png`);
 }
 expect(errors).toEqual([]);
});

test('admin team controls and review queues retain their bounded forms and navigation',async({page},info)=>{
 test.setTimeout(150000);await auditLogin(page,'admin@loadgistic.local');
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});await page.goto('/admin/support?tab=team');await expect(page.getByRole('heading',{name:'Platform team',exact:true})).toBeVisible();
  const create=page.locator('form[action="/api/admin/support-agents"]');await page.getByRole('button',{name:'Add member',exact:true}).click();
  await expect(create.getByLabel('Name',{exact:true})).toBeVisible();await expect(create.getByLabel('Sign-in email',{exact:true})).toBeVisible();
  for(const name of ['Customers','Operations','Trust','Support','Featured'])await expect(create.getByRole('checkbox',{name,exact:true})).toBeVisible();
  await expect(create.getByRole('checkbox',{name:'Brokerage',exact:true})).toHaveCount(0);
  await expect(create.getByLabel('Max open chats')).toHaveAttribute('min','1');await expect(create.getByLabel('Max open chats')).toHaveAttribute('max','20');
  const box=await create.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await capture(page,info,`admin-team-form-${width}.png`);
  await page.getByRole('dialog',{name:'Add member',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();
  for(const [path,title]of [['/admin/reviews?status=ALL','Review Center'],['/admin/reviews/content','Content reports'],['/admin/privacy','Account deletion requests']]){
   const response=await page.goto(path);expect(response?.status()).toBe(200);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await capture(page,info,`admin-${title.replaceAll(' ','-').toLowerCase()}-${width}.png`);
  }
 }
 expect(errors).toEqual([]);
});

test('staff Featured and sponsor controls remain usable while platform brokerage stays retired',async({page},info)=>{
 test.setTimeout(150000);await auditLogin(page,'admin@loadgistic.local');
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});await page.goto('/admin/featured');
  await expect(page.getByRole('heading',{name:'Daily Featured Vehicles',exact:true})).toBeVisible();await expect(page.locator('.featured-upcoming-days > a')).toHaveCount(7);
  await expect(page.getByRole('button',{name:'Prepare upcoming days',exact:true})).toBeVisible();
  await page.locator('.featured-operation-overview details > summary').click();
  await expect(page.getByText(/Sunday uses those same turns/)).toBeVisible();await expect(page.getByText(/Manual drafts stay private until published/)).toBeVisible();
  await page.locator('.featured-operation-overview details > summary').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await capture(page,info,`admin-featured-${width}.png`);
  await page.getByRole('button',{name:'Schedule sponsor',exact:true}).click();const sponsor=page.locator('.featured-sponsor-form');
  await sponsor.getByLabel('Sponsor type',{exact:true}).selectOption('ADVERTISER');
  await expect(sponsor.getByLabel('Business name',{exact:true})).toBeVisible();await expect(sponsor.getByLabel('Short description',{exact:true})).toBeVisible();
  await expect(sponsor.getByLabel('Website (optional)',{exact:true})).toBeVisible();await expect(sponsor.getByLabel('Public phone (optional)',{exact:true})).toBeVisible();
  await expect(sponsor.getByLabel('Position',{exact:true}).locator('option')).toHaveCount(5);
  await expect(sponsor.locator('button[name=command][value=SAVE_SPONSOR]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await capture(page,info,`admin-sponsor-${width}.png`);
  await page.goto('/admin/support/transport-requests?queue=ALL&view=ALL');
  await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();
  await expect(page.locator('.transport-request-card')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await capture(page,info,`admin-retired-brokerage-${width}.png`);
 }
 expect(errors).toEqual([]);
});

test('administrator Overview final copy and settled phone Featured capture',async({page},info)=>{
 test.setTimeout(90000);
 await auditLogin(page,'admin@loadgistic.local');await page.setViewportSize({width:1440,height:900});await page.goto('/admin');
 const overview=page.locator('.admin-overview-page');await expect(overview.getByText('People and provider accounts',{exact:true})).toBeVisible();
 await expect(overview.getByText('Registered vehicles',{exact:true})).toBeVisible();await expect(overview.getByText('Shipments and progress updates',{exact:true})).toBeVisible();
 await capture(page,info,'admin-overview-1440-final.png');
 await page.setViewportSize({width:320,height:900});await page.goto('/admin/featured',{waitUntil:'domcontentloaded',timeout:60000});await expect(page.getByRole('heading',{name:'Daily Featured Vehicles',exact:true})).toBeVisible({timeout:30000});
 await capture(page,info,'admin-featured-320-settled.png');
});
