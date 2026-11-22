import {test,expect} from './browser-test';

test('Install app is reachable from navigation and private pages use a generic offline fallback',async({page,context},info)=>{
 test.setTimeout(120000);
 const phone=info.project.name.includes('mobile');
 await page.goto('/about');
 const install=phone?page.locator('main').getByRole('link',{name:'Install app',exact:true}):
  page.getByRole('navigation',{name:'Site navigation'}).getByRole('link',{name:'Install app',exact:true});
 await expect(install).toHaveAttribute('href','/install');
 if(!phone){
  const rail=page.getByRole('navigation',{name:'Site navigation'});
  const about=await rail.getByRole('link',{name:'About',exact:true}).boundingBox();
  const entry=await install.boundingBox();
  expect(entry!.y).toBeGreaterThan(about!.y);
 }
 await page.evaluate(()=>{
  const event=Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{
   prompt:async()=>{document.documentElement.dataset.testPwaPrompt='shown';return {outcome:'dismissed'};}
  });
  window.dispatchEvent(event);
 });
 await install.click();
 await expect(page.locator('html')).toHaveAttribute('data-test-pwa-prompt','shown');
 await expect(page).toHaveURL(/\/about$/);
 // Chrome can announce installability after the synthetic prompt, which
 // would make the next click open its prompt instead of the fallback route.
 await page.evaluate(()=>{
  delete (window as Window&{loadgisticInstallPrompt?:Event}).loadgisticInstallPrompt;
  window.addEventListener('beforeinstallprompt',event=>event.stopImmediatePropagation(),{capture:true});
 });
 await install.click();
 await expect(page).toHaveURL(/\/install$/,{timeout:25000});
 await expect(page.getByRole('heading',{name:'Install Loadgistic',exact:true})).toBeVisible();
 await expect(page.getByText('Open your browser menu and choose Install app or Add to Home screen.',{exact:true})).toBeVisible();
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),{timeout:20000});
 expect(await page.evaluate(async()=>{
  const urls=(await Promise.all((await caches.keys()).map(async key=>(await (await caches.open(key)).keys()).map(request=>new URL(request.url).pathname)))).flat();
  return urls.includes('/pwa-offline.html')&&urls.every(url=>!/^\/(api|app|track|_next)(\/|$)/.test(url));
 })).toBe(true);
 await context.setOffline(true);
 try{
  await page.goto('/app/fleet',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'You’re offline',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('offline-fallback.png')});
 }finally{await context.setOffline(false);}
 await page.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible({timeout:25000});
});
