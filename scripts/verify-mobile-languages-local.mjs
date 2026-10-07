import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {nativeMessages} from '../apps/mobile/src/localization/messages.ts';
const root=new URL('../',import.meta.url),locales=['am','om','so','ti'];
assert.match(readFileSync(new URL('.env.local',root),'utf8'),/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m);
const catalogs=Object.fromEntries(locales.map(locale=>[locale,{...JSON.parse(readFileSync(new URL(`src/lib/i18n/messages/${locale}.json`,root),'utf8')),...nativeMessages[locale]}]));
const names={am:'አማርኛ',om:'Afaan Oromo',so:'Soomaali',ti:'ትግርኛ'},buttons={am:'ኮድ ላክ',om:'Koodii ergi',so:'Dir koodka',ti:'ኮድ ልኣኽ'};
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:412,height:915}}),errors=[];
 page.on('pageerror',error=>errors.push(error.name));
 await page.goto('http://localhost:8084/account',{waitUntil:'domcontentloaded',timeout:90000});
 await page.getByRole('button',{name:'Send code',exact:true}).waitFor({timeout:60000});
 let current='en';
 for(const locale of locales){
  await page.getByRole('button',{name:current==='en'?'Language':catalogs[current].Language,exact:true}).click();
  await page.getByRole('radio',{name:names[locale],exact:true}).click();
  await page.getByRole('dialog').getByRole('button').first().click();
  await page.getByRole('button',{name:buttons[locale],exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.screenshot({path:new URL(`.local/mobile-language-${locale}.png`,root).pathname});current=locale;
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: four selected languages show translated phone sign-in controls without overflow or browser exceptions.');
}finally{await browser.close();}
