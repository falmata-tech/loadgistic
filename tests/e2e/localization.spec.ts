import {readFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';

const languages=[['am','ስለ Loadgistic'],['om','Waa’ee Loadgistic'],['so','Ku saabsan Loadgistic'],['ti','ብዛዕባ Loadgistic'],['en','About Loadgistic']] as const;

test('language changes preserve form content and persist across public navigation',async({page}:{page:import('playwright-core').Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',(error:Error)=>errors.push(error.message));
 await page.goto('/login');const picker=page.locator('.language-picker select');await expect(picker).toHaveCount(1);await expect(picker).toBeEnabled();
 const email=page.locator('input[name=email]');await email.fill('Home+Account@example.test');
 for(const [locale] of languages){await picker.selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);await expect(email).toHaveValue('Home+Account@example.test');await expect(email).toHaveAttribute('name','email');await expect(page.getByTestId('email-code-request-form')).toHaveAttribute('action','/api/applications/email-otp/request');}
 for(const [locale,about] of languages){
  await picker.selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);await page.goto('/about');await expect(page.locator('.public-information-heading')).toContainText(about);
  await page.reload();await expect(picker).toHaveCount(1);await expect(picker).toBeEnabled();await expect(page.locator('html')).toHaveAttribute('lang',locale);await expect(picker).toHaveValue(locale);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`about-${locale}.png`),fullPage:true});
 }
 expect(errors).toEqual([]);
});

test('language control remains separate from phone map support and account actions',async({page}:{page:import('playwright-core').Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);await page.goto('/');
 for(const width of [320,390,760]){
  await page.setViewportSize({width,height:844});
  for(const [locale] of languages){
   const picker=page.locator('.public-header-language select');await expect(picker).toHaveCount(1);await expect(picker).toBeEnabled();await picker.selectOption(locale);
   await expect(page.locator('html')).toHaveAttribute('lang',locale);
   const bounds=await Promise.all([picker,page.locator('.public-chat-launcher'),page.getByTestId('public-session-action')].map(element=>element.boundingBox()));
   expect(bounds.every(Boolean)).toBe(true);
   for(let i=0;i<bounds.length;i++){const a=bounds[i]!;expect(a.x).toBeGreaterThanOrEqual(0);expect(a.x+a.width).toBeLessThanOrEqual(width+1);
    for(let j=i+1;j<bounds.length;j++){const b=bounds[j]!;expect(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1,JSON.stringify({width,locale,i,j,bounds})).toBe(true);}
   }
  }
  await page.screenshot({path:info.outputPath(`map-header-${width}.png`),fullPage:true});
 }
});


test('profile headings and filter distances translate without rewriting transporter content',async({page}:{page:import('playwright-core').Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(120000);await page.goto('/@rift-valley-haulage-02');
 const name=await page.locator('.provider-site-identity h1').innerText();
 const about=await page.locator('.provider-about-card .lede').innerText();
 const picker=page.locator('.language-picker select');
 for(const [locale] of languages){
  const messages=locale==='en'?{}:JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  const t=(message:string)=>messages[message]||message;
  await expect(picker).toHaveCount(1);await expect(picker).toBeEnabled();await picker.selectOption(locale);
  await expect(page.locator('html')).toHaveAttribute('lang',locale);
  await expect(page.locator('.provider-site-identity h1')).toHaveText(name);
  await expect(page.locator('.provider-handle')).toContainText(t('Fleet transporter'));
  await expect(page.locator('.provider-hero-facts')).toContainText(t('New to Loadgistic'));
  await expect(page.locator('.provider-about-card .lede')).toHaveText(about);
  await expect(page.locator('.provider-services small')).toHaveText(t('Transport services'));
  await expect(page.getByRole('heading',{name:t('Verified shipment reviews'),exact:true})).toBeVisible();
  await expect(page.locator('.fleet-open-label')).toHaveText(t('View trucks and drivers'));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`profile-${locale}.png`),fullPage:true});
 }
 await page.goto('/');
 for(const [locale] of languages){
  const messages=locale==='en'?{}:JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  await expect(picker).toHaveCount(1);await expect(picker).toBeEnabled();await picker.selectOption(locale);
  await expect(page.locator('html')).toHaveAttribute('lang',locale);
  const option=page.locator('select[name=originRadiusKm] option[value="50"]');
  await expect(option).toHaveText((messages['Within {distance} km']||'Within {distance} km').replace('{distance}','50'));
  await expect(option).toHaveAttribute('value','50');
 }
});
