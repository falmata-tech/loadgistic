import {test,expect} from './browser-test';
import {auditProvider,checked,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {readFileSync} from 'node:fs';

const widths=[320,390,768,1024,1440,1920];

test('account choices reveal concise benefits without crowding phone signup',async({page},info)=>{
 test.setTimeout(90_000);
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:760});
  await page.goto('/signup');
  await expect(page.getByRole('radio',{name:'Put your vehicles on the map'})).toBeChecked();
  await expect(page.getByText('Manage vehicles and drivers; add compatible GPS with our help.')).toBeVisible();
  await page.getByRole('radio',{name:'Find room for your load'}).check();
  await expect(page.getByText('Build a private map from transporters who share with your team.')).toBeVisible();
  await page.getByRole('radio',{name:'Put your vehicles on the map'}).check();
  await expect(page.getByText('Build a private map from transporters who share with your team.')).toBeHidden();
  await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'See how Loadgistic works'})).toHaveAttribute('href','/about');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth),`signup overflow at ${width}px`).toBeLessThanOrEqual(width+1);
  await page.screenshot({path:info.outputPath(`signup-benefits-${width}.png`)});
 }
 await page.setViewportSize({width:320,height:760});
 for(const locale of ['am','om']){
  await page.locator('.language-picker select:visible').selectOption(locale);
  const catalog=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  await expect(page.getByText(catalog['Manage vehicles and drivers; add compatible GPS with our help.'])).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth),`${locale} signup overflow`).toBeLessThanOrEqual(321);
  await page.screenshot({path:info.outputPath(`signup-benefits-${locale}-320.png`)});
 }
});

test('Expo signup presents the same account benefits on a narrow phone',async({page},info)=>{
 test.setTimeout(90_000);
 await page.setViewportSize({width:320,height:760});
 await page.goto('http://localhost:8084/signup');
 await expect(page.getByRole('radio',{name:'Find room for your load'})).toBeVisible();
 await expect(page.getByText('Build a private map from transporters who share with your team.')).toBeVisible();
 await page.getByRole('radio',{name:'Put your vehicles on the map'}).click();
 await expect(page.getByText('Manage vehicles and drivers; add compatible GPS with our help.')).toBeVisible();
 await expect(page.getByText('Build a private map from transporters who share with your team.')).toHaveCount(0);
 await expect(page.getByRole('link',{name:'See how Loadgistic works'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
 await page.screenshot({path:info.outputPath('expo-signup-benefits-320.png')});
});

test('account entry and signed-in navigation remain usable across phone, tablet and desktop widths',async({page},info)=>{
 test.setTimeout(150_000);
 await page.setViewportSize({width:widths[0],height:760});
 await page.goto('/signup');
 for(const width of widths){
  await page.setViewportSize({width,height:width<=390?760:900});
  await expect(page.getByRole('heading',{name:'Create an account'})).toBeVisible();
  await expect(page.getByRole('radio',{name:'Put your vehicles on the map'})).toBeVisible();
  await expect(page.getByText('Manage vehicles and drivers; add compatible GPS with our help.')).toBeVisible();
  await page.getByRole('radio',{name:'Find room for your load'}).check();
  await expect(page.getByText('Build a private map from transporters who share with your team.')).toBeVisible();
  await page.getByRole('radio',{name:'Put your vehicles on the map'}).check();
  await expect(page.getByText('Build a private map from transporters who share with your team.')).toBeHidden();
  await expect(page.getByRole('link',{name:'See how Loadgistic works'})).toHaveAttribute('href','/about');
  await expect(page.getByRole('link',{name:'Sign in'}).last()).toBeVisible();
  const documentWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
  expect(documentWidth,`signup horizontal overflow at ${width}px`).toBeLessThanOrEqual(width+1);
  if([320,390,1440].includes(width))await page.screenshot({path:info.outputPath(`signup-${width}.png`)});
 }
 const service=localAuditService();
 const identity=await auditProvider(service,'shell-sizes');
 try{
 await localSupportLogin(page,identity.id);
 await page.goto('/app/network');
 for(const width of widths){
  await page.setViewportSize({width,height:width<=390?760:900});
  await expect(page.locator('header.unified-site-header')).toBeVisible();
  const nav=page.getByRole('navigation',{name:width<=760?'Mobile navigation':'Site navigation'});
  await expect(nav).toBeVisible();
  const metrics=await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,viewportWidth:window.innerWidth}));
  if(metrics.documentWidth>metrics.viewportWidth+1){
   const offenders=await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).map(element=>({tag:element.tagName,classes:typeof element.className==='string'?element.className.slice(0,70):'',right:Math.round(element.getBoundingClientRect().right)})).filter(item=>item.right>window.innerWidth+1).slice(0,12));
   console.log('Horizontal overflow elements',width,offenders);
  }
  expect(metrics.documentWidth,`workspace horizontal overflow at ${width}px`).toBeLessThanOrEqual(metrics.viewportWidth+1);
  if(width<=760){
   const home=await nav.getByRole('link',{name:'Home',exact:true}).boundingBox();
   const more=await nav.getByRole('button',{name:'More'}).boundingBox();
   expect(home&&more&&Math.abs(home.y-more.y)<3,`bottom navigation wrapped at ${width}px`).toBeTruthy();
  }
  if([320,768,1440].includes(width))await page.screenshot({path:info.outputPath(`workspace-${width}.png`)});
 }
 }finally{
  await page.goto('about:blank');
  checked(await service.from('audit_logs').delete().eq('actor_user_id',identity.id));
  checked(await service.auth.admin.deleteUser(identity.id));
 }
});
