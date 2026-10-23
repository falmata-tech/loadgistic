import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {nativeMessages} from '../apps/mobile/src/localization/messages.ts';
const root=new URL('../',import.meta.url),locales=['am','om'];
assert.match(readFileSync(new URL('.env.local',root),'utf8'),/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m);
const catalogs=Object.fromEntries(locales.map(locale=>[locale,{...JSON.parse(readFileSync(new URL(`src/lib/i18n/messages/${locale}.json`,root),'utf8')),...nativeMessages[locale]}]));
const names={am:'አማርኛ',om:'Afaan Oromo'},buttons={am:'ኮድ ላክ',om:'Koodii ergi'};
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:412,height:915}}),errors=[];
 page.on('pageerror',error=>errors.push(error.name));
 await page.goto('http://localhost:8084/account',{waitUntil:'domcontentloaded',timeout:90000});
 await page.getByRole('button',{name:'Send code',exact:true}).waitFor({timeout:60000});
 await page.screenshot({path:new URL('.local/mobile-language-en.png',root).pathname});
 await page.getByRole('button',{name:'Language',exact:true}).click();
 const menu=page.getByRole('dialog');
 await page.getByRole('radio',{name:names.am,exact:true}).waitFor();
 assert.equal(await page.getByRole('radio').count(),3);
 await page.screenshot({path:new URL('.local/mobile-language-menu-en.png',root).pathname});
 await menu.getByRole('button').first().click();
 let current='en';
 for(const locale of locales){
  await page.getByRole('button',{name:current==='en'?'Language':catalogs[current].Language,exact:true}).click();
  await page.getByRole('radio',{name:names.am,exact:true}).waitFor();
  assert.equal(await page.getByRole('radio').count(),3);
  await page.getByRole('radio',{name:names[locale],exact:true}).click();
  await page.screenshot({path:new URL(`.local/mobile-language-menu-${locale}.png`,root).pathname});
  await page.getByRole('dialog').getByRole('button').first().click();
  await page.getByRole('button',{name:buttons[locale],exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.screenshot({path:new URL(`.local/mobile-language-${locale}.png`,root).pathname});current=locale;
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: both selected translations show phone sign-in controls without overflow or browser exceptions.');
}finally{await browser.close();}
