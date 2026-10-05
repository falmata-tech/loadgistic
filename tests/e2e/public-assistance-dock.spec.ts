import {test,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});
import type {Page} from 'playwright-core';
import {readFileSync} from 'node:fs';
import {openCapacityFilters,closeCapacityFilters} from './capacity-drawer-helper';

test('public request has one floating action, preserves its draft and leaves map controls usable',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(60000);
 await page.goto('/');
 const dock=page.locator('.public-assistance-dock');
 await expect(page.locator('.leaflet-container')).toBeVisible();
 await expect(page.locator('.market-entry')).toHaveCount(0);
 const share=page.getByRole('link',{name:'Transporter login',exact:true}).filter({visible:true});
 await expect(share).toBeVisible();await expect(share).toHaveAttribute('href','/login');
 const request=dock.getByRole('button',{name:'Arrange transport',exact:true});
 await expect(request.getByText('Live chat', {exact:true})).toBeVisible();
 await expect(dock.getByRole('button')).toHaveCount(1);await expect(request).toBeEnabled();
 expect((await request.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 await request.click();const form=page.locator('.transport-request-form');await expect(form).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Help options'})).toHaveCount(0);
 await expect(page.locator('.public-chat-presence,.public-chat-composer,.public-chat-start')).toHaveCount(0);
 await expect(page.getByRole('dialog',{name:'Let us arrange your transport',exact:true})).toBeVisible();
 await expect(page.locator('.transport-chat-heading')).toContainText('Live chat with our transport team');
 await expect(form.getByRole('button',{name:'Start chat',exact:true})).toBeVisible();
 await expect(page.locator('.public-chat-presence.online')).toHaveCount(0);
 await form.locator('[name=origin]').fill('Adama');await form.locator('[name=name]').fill('Local review');
 await page.screenshot({path:info.outputPath('request-panel.png')});
 await page.getByRole('button',{name:'Close',exact:true}).click();await request.click();await expect(form.locator('[name=origin]')).toHaveValue('Adama');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 for(const drawerOpen of [true,false]){
  if(drawerOpen)await openCapacityFilters(page);else await closeCapacityFilters(page);
  await expect.poll(()=>page.evaluate(()=>{
   const dock=document.querySelector('.public-assistance-dock')!.getBoundingClientRect();
   const overlaps=(r:DOMRect)=>dock.left<r.right&&dock.right>r.left&&dock.top<r.bottom&&dock.bottom>r.top;
   return [...document.querySelectorAll('.capacity-drawer-actions button,.capacity-drawer-actions a,.public-map-legend summary,.public-mobile-nav,.public-header a')].filter(el=>el.checkVisibility()).every(el=>!overlaps(el.getBoundingClientRect()));
  })).toBe(true);
  await page.screenshot({path:info.outputPath(drawerOpen?'drawer-open.png':'map.png')});
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('old public chat state cannot restore chat or start background polling',async({page}:{page:Page})=>{
 const requests:string[]=[];page.on('request',r=>{if(r.url().includes('/api/guest-support')||r.url().includes('/api/support/updates'))requests.push(r.url());});
 await page.addInitScript(()=>{sessionStorage.setItem('loadgistic-public-chat-open','1');sessionStorage.setItem('loadgistic-assistance-mode','help');});
 await page.goto('/about');const dock=page.locator('.public-assistance-dock');
 await expect(dock.getByRole('button',{name:'Arrange transport',exact:true}).getByText('Live chat', {exact:true})).toBeVisible();
 await expect(dock.getByRole('button')).toHaveCount(1);await expect(page.locator('dialog[open]')).toHaveCount(0);
 await dock.getByRole('button',{name:'Arrange transport',exact:true}).click();await expect(page.locator('.transport-request-form')).toBeVisible();
 await page.reload();await expect(page.getByRole('dialog',{name:'Let us arrange your transport',exact:true})).toBeVisible();
 await expect(page.locator('.public-chat-composer,.public-chat-presence')).toHaveCount(0);
 expect(requests).toEqual([]);
});


test('live chat entry is clear and usable in every language on a narrow phone',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);await page.setViewportSize({width:320,height:568});await page.goto('/about');
 for(const locale of ['en','am','om','so','ti']){
  const messages:Record<string,string>=locale==='en'?{}:JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  const text=(key:string)=>messages[key]||key;
  await page.locator('.language-picker select:visible').selectOption(locale);
  const entry=page.locator('.public-assistance-request');await expect(entry).toContainText(text('Live chat'));await entry.click();
  const dialog=page.locator('.public-chat-dialog'),form=dialog.locator('.transport-request-form');
  await expect(dialog.locator('.transport-chat-heading')).toContainText(text('Live chat with our transport team'));
  await expect(dialog.getByRole('heading')).toHaveCount(1);await expect(form.locator('input')).toHaveCount(4);
  await form.locator('[name=origin]').fill('Adama');
  const start=form.getByRole('button',{name:text('Start chat'),exact:true});await start.scrollIntoViewIfNeeded();await start.click({trial:true});
  const button=await start.boundingBox(),panel=await dialog.boundingBox();expect(button!.x).toBeGreaterThanOrEqual(panel!.x);expect(button!.x+button!.width).toBeLessThanOrEqual(panel!.x+panel!.width);expect(button!.y+button!.height).toBeLessThanOrEqual(panel!.y+panel!.height);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`chat-entry-${locale}.png`)});
  await dialog.locator(':scope > header button').click();await entry.click();await expect(form.locator('[name=origin]')).toHaveValue('Adama');await dialog.locator(':scope > header button').click();
 }
});
