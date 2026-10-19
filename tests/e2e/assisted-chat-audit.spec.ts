import type {Page} from 'playwright-core';
import {test,expect} from './browser-test';

test('retired transport request launcher remains absent before and after hydration',async({page}:{page:any})=>{
  let releaseScripts=()=>{};
  const scriptsReady=new Promise<void>(resolve=>{releaseScripts=resolve;});
  await page.route('**/_next/**/*.js*',async(route:any)=>{
    await scriptsReady;
    await route.continue();
  });
  try{
    await page.goto('/about',{waitUntil:'commit'});
    const launcher=page.getByRole('button',{name:'Need help with transport?',exact:true});
    await expect(launcher).toHaveCount(0);
    releaseScripts();
    await expect(page.locator('main.public-information-workspace')).toBeVisible();
    await expect(launcher).toHaveCount(0);
    await expect(page.locator('.public-chat-dialog,.transport-request-form')).toHaveCount(0);
  }finally{
    releaseScripts();
    await page.unrouteAll({behavior:'wait'});
  }
});


test('old guest chat endpoints deny writes before processing contact data or attachments',async({page}:{page:Page})=>{
 const id='00000000-0000-4000-8000-000000000108';
 for(const endpoint of ['/api/guest-support',`/api/guest-support/${id}/messages`]){
  const response=await page.request.post(endpoint,{multipart:{body:'Retired public chat',file:{name:'not-an-image.png',mimeType:'image/png',buffer:Buffer.from('must not be uploaded')}}});
  expect(response.status()).toBe(410);expect((await response.json()).error).toContain('Software support is available in your workspace.');
 }
 expect((await page.request.get('/api/guest-support/current')).status()).toBe(410);
 expect((await page.request.get(`/api/support/updates?kind=GUEST&participant=GUEST&conversation=${id}`)).status()).toBe(410);
});
