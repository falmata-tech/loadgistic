import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeMessages} from '../apps/mobile/src/localization/messages.ts';
import {languages as nativeLanguages} from '../apps/mobile/src/localization/controller.ts';
import {chromium} from 'playwright';
import {expect as baseExpect} from '@playwright/test';
const root=new URL('../',import.meta.url),expect=baseExpect.configure({timeout:20000});
const catalogs=Object.fromEntries(['am','om','so','ti'].map(locale=>[locale,JSON.parse(readFileSync(new URL(`src/lib/i18n/messages/${locale}.json`,root),'utf8'))]));
const label=(locale,key)=>catalogs[locale]?.[key]||key;
const languages=nativeLanguages.map(item=>[item.code,item.name]),nativeLabel=(locale,key)=>nativeMessages[locale]?.[key]||label(locale,key);
const browser=await chromium.launch({headless:true}),errors=[];let stage='setup',currentPage;
async function capture(page,name){await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Narrow page overflow');
 await page.screenshot({path:new URL(`.local/chat-alert-${name}.png`,root).pathname,fullPage:true});
}
try{
 const nc=await browser.newContext({viewport:{width:320,height:800}}),np=await nc.newPage();np.on('pageerror',error=>errors.push(error.name));await np.goto('http://localhost:8084/arrange-transport',{waitUntil:'domcontentloaded',timeout:90000});
 currentPage=np;let current='en';for(const [locale,name] of languages){stage='native '+locale+' select';
  await np.getByRole('button',{name:nativeLabel(current,'Language'),exact:true}).click();await np.getByRole('radio',{name,exact:true}).click();await expect(np.getByRole('radio',{name,exact:true})).toHaveAttribute('aria-checked','true');
  stage='native '+locale+' close picker';await np.getByRole('button',{name:nativeLabel(locale,'Close menu'),exact:true}).click();await expect(np.getByRole('button',{name:nativeLabel(locale,'Close menu'),exact:true})).toHaveCount(0);
  stage='native '+locale+' updates';await np.getByRole('button',{name:nativeLabel(locale,'Open menu'),exact:true}).click();await np.getByRole('button',{name:nativeLabel(locale,'Chat updates'),exact:true}).click();await expect(np.getByRole('button',{name:nativeLabel(locale,'Close menu'),exact:true})).toHaveCount(0);
  const close=np.getByRole('button',{name:nativeLabel(locale,'Close'),exact:true});await expect(close).toBeVisible();await capture(np,'native-'+locale+'-320');
  const box=await close.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=320&&box.width>=44&&box.height>=44,'Reachable native close');await close.click();current=locale;
 }await nc.close();
 const wc=await browser.newContext({viewport:{width:320,height:800}}),wp=await wc.newPage();wp.on('pageerror',error=>errors.push(error.name));await wp.goto('http://127.0.0.1:3100/about',{waitUntil:'domcontentloaded',timeout:90000});
 currentPage=wp;current='en';for(const [locale] of languages){stage='web '+locale;await wp.getByRole('combobox',{name:label(current,'Language'),exact:true}).selectOption(locale);
  const launcher=wp.getByRole('button',{name:label(locale,'Need help with transport?'),exact:true});await expect(launcher).toBeEnabled();await launcher.click();
  const dialog=wp.locator('.public-chat-dialog');await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:label(locale,'Start chat'),exact:true})).toBeVisible();await expect(dialog.getByRole('button',{name:label(locale,'Turn on chat sound'),exact:true})).toBeVisible();await capture(wp,'web-'+locale+'-320');
  if(locale==='en'){await dialog.getByRole('button',{name:'Turn on chat sound',exact:true}).click();await expect(dialog.getByRole('button',{name:'Sound on',exact:true})).toHaveAttribute('aria-pressed','true');await dialog.getByRole('button',{name:'Sound on',exact:true}).click();}
  await dialog.getByRole('button',{name:label(locale,'Close'),exact:true}).click();current=locale;
 }await wc.close();assert.deepEqual(errors,[]);console.log('PASS: five-language 320px web/native chat-update entry and dialogs, reachable close, no overflow/runtime errors and actual opt-in web audio');
}catch(error){await currentPage?.screenshot({path:new URL('.local/chat-alert-layout-failure.png',root).pathname,fullPage:true}).catch(()=>{});throw Error('CHAT_ALERT_LAYOUT_FAILED: '+stage+' · '+error.name);}
finally{await browser.close();}
