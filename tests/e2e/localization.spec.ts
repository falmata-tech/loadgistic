import {readFileSync} from 'node:fs';
import {test,expect} from './browser-test';

const languages=[['am','ስለ Loadgistic'],['om','Waa’ee Loadgistic'],['so','Ku saabsan Loadgistic'],['en','About Loadgistic']] as const;

test('language changes preserve form content and persist across public navigation',async({page}:{page:import('playwright-core').Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',(error:Error)=>errors.push(error.message));
 await page.goto('/login',{waitUntil:'domcontentloaded'});const picker=page.locator('.language-picker select');await expect(picker).toHaveCount(1);await expect(picker).toBeEnabled();
 const email=page.getByTestId('email-code-request-form').locator('input[name=email]');await email.fill('Home+Account@example.test');
 for(const [locale] of languages){await picker.selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);await expect(email).toHaveValue('Home+Account@example.test');await expect(email).toHaveAttribute('name','email');await expect(page.getByTestId('email-code-request-form')).toHaveAttribute('action','/api/applications/email-otp/request');}
 for(const [locale,about] of languages){
  await picker.selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);await page.goto('/about',{waitUntil:'domcontentloaded'});await expect(page.getByRole('tablist',{name:about})).toBeVisible();
  await page.reload({waitUntil:'domcontentloaded'});await expect(picker).toHaveCount(1);await expect(picker).toBeEnabled();await expect(page.locator('html')).toHaveAttribute('lang',locale);await expect(picker).toHaveValue(locale);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`about-${locale}.png`),fullPage:true});
 }
 expect(errors).toEqual([]);
});

test('language control remains separate from phone map filters and account actions',async({page}:{page:import('playwright-core').Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);await page.goto('/');
 for(const width of [320,390,760]){
  await page.setViewportSize({width,height:844});
  for(const [locale] of languages){
   const picker=page.locator('.public-header-language select');await expect(picker).toHaveCount(1);await expect(picker).toBeEnabled();await picker.selectOption(locale);
   await expect(page.locator('html')).toHaveAttribute('lang',locale);
   const bounds=await Promise.all([picker,page.locator('.capacity-filter-trigger'),page.getByTestId('public-session-action')].map(element=>element.boundingBox()));
   expect(bounds.every(Boolean)).toBe(true);
   for(let i=0;i<bounds.length;i++){const a=bounds[i]!;expect(a.x).toBeGreaterThanOrEqual(0);expect(a.x+a.width).toBeLessThanOrEqual(width+1);
    for(let j=i+1;j<bounds.length;j++){const b=bounds[j]!;expect(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1,JSON.stringify({width,locale,i,j,bounds})).toBe(true);}
   }
   if(locale==='so'){
    const capacityLabel=page.locator('.public-mobile-nav a[href="/"] span');
    await expect(capacityLabel).toBeVisible();
    expect(await capacityLabel.evaluate(label=>label.scrollWidth<=label.clientWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`map-header-so-${width}.png`)});
   }
  }
  await page.screenshot({path:info.outputPath(`map-header-${width}.png`),fullPage:true});
 }
});


test('profile headings and filter distances translate without rewriting transporter content',async({page}:{page:import('playwright-core').Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(120000);await page.goto('/@rift-valley-haulage-02');
 const name=await page.locator('.provider-site-identity h1').innerText();
 const aboutPanel=page.locator('.provider-profile-about');
 await expect(aboutPanel).toBeVisible();
 const about=await aboutPanel.locator('p').first().innerText();
 const picker=page.locator('.language-picker select');
 for(const [locale] of languages){
  const messages=locale==='en'?{}:JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  const t=(message:string)=>messages[message]||message;
  await expect(picker).toHaveCount(1);await expect(picker).toBeEnabled();await picker.selectOption(locale);
  await expect(page.locator('html')).toHaveAttribute('lang',locale);
  await expect(page.locator('.provider-site-identity h1')).toHaveText(name);
  await expect(page.locator('.provider-handle')).toHaveText(t('Transport Provider'));
  for(const heading of ['Account documents','About this transporter','Verified shipment reviews']){
   await expect(page.getByRole('heading',{name:t(heading),exact:true})).toBeVisible();
  }
  await expect(aboutPanel).toContainText(about);
  await expect(page.locator('.provider-services,.provider-corridor-list,.provider-microsite-safety')).toHaveCount(0);
  await expect(page.locator('.provider-map-workbench .leaflet-container')).toBeVisible();
  await expect(page.getByRole('heading',{name:t('Verified shipment reviews'),exact:true})).toBeVisible();
  await expect(page.locator('.provider-fleet-disclosure')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`profile-${locale}.png`),fullPage:true});
 }
 await page.goto('/');
 for(const [locale] of languages){
  const messages=locale==='en'?{}:JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  const t=(message:string)=>messages[message]||message;
  await expect(picker).toHaveCount(1);await expect(picker).toBeEnabled();await picker.selectOption(locale);
  await expect(page.locator('html')).toHaveAttribute('lang',locale);
  await page.getByRole('button',{name:t('Vehicle filters'),exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-filter-section="availability"] summary').click();
  await dialog.getByRole('button',{name:t('Route'),exact:true}).click();
  await expect(dialog.locator('input[name=departAfter]')).toBeVisible();
  await expect(dialog.locator('select[name=originRadiusKm]')).toBeVisible();
  const option=page.locator('select[name=originRadiusKm] option[value="50"]');
  await expect(option).toHaveText(t('Within {distance} km').replace('{distance}','50'));
  await expect(option).toHaveAttribute('value','50');
  await page.screenshot({path:info.outputPath(`route-filter-${locale}.png`)});
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
 }
});

test('Somali guidance explains the two tracking fields and an invalid ID',async({page},info)=>{
 const messages=JSON.parse(readFileSync('src/lib/i18n/messages/so.json','utf8'));
 await page.goto('/track');
 const picker=page.locator('.public-header-language select');
 await expect(picker).toBeEnabled();
 await picker.selectOption('so');
 await expect(page.locator('html')).toHaveAttribute('lang','so');
 await expect(page.getByRole('heading',{name:messages['Follow your shipment'],exact:true})).toBeVisible();
 const id=page.getByLabel(messages['Tracking ID'],{exact:true});
 const code=page.getByLabel(messages['Tracking code'],{exact:true});
 await id.fill('invalid');
 await code.fill('ABCD-EFGH');
 await page.getByRole('button',{name:messages['Open tracking'],exact:true}).click();
 await expect(page.locator('.tracking-unlock-panel').getByRole('alert')).toHaveText(messages['Enter the tracking ID you received.']);
 await expect(id).toHaveValue('invalid');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('tracking-so-invalid-id.png')});
});
