import type {Page} from 'playwright-core';
import {test,expect} from '@playwright/test';

test('transport request launcher waits for hydration before accepting its first click',async({page}:{page:any})=>{
  let releaseScripts=()=>{};
  const scriptsReady=new Promise<void>(resolve=>{releaseScripts=resolve;});
  await page.route('**/_next/**/*.js*',async(route:any)=>{
    await scriptsReady;
    await route.continue();
  });
  try{
    await page.goto('/about',{waitUntil:'commit'});
    const launcher=page.getByRole('button',{name:'Need help with transport?',exact:true});
    await expect(launcher).toBeVisible();
    await expect(launcher).toBeDisabled();
    releaseScripts();
    await expect(launcher).toBeEnabled();
    await launcher.click();
    const dialog=page.getByRole('dialog',{name:'Need help with transport?'});
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button',{name:'Start chat'})).toBeVisible();
  }finally{
    releaseScripts();
    await page.unrouteAll({behavior:'wait'});
  }
});


test('old guest chat endpoints deny writes before processing contact data or attachments',async({page}:{page:Page})=>{
 const id='00000000-0000-4000-8000-000000000108';
 for(const endpoint of ['/api/guest-support',`/api/guest-support/${id}/messages`]){
  const response=await page.request.post(endpoint,{multipart:{body:'Retired public chat',file:{name:'not-an-image.png',mimeType:'image/png',buffer:Buffer.from('must not be uploaded')}}});
  expect(response.status()).toBe(410);expect((await response.json()).error).toContain('transport providers');
 }
 expect((await page.request.get('/api/guest-support/current')).status()).toBe(410);
 expect((await page.request.get(`/api/support/updates?kind=GUEST&participant=GUEST&conversation=${id}`)).status()).toBe(410);
});
