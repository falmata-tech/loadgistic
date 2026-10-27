import {test,expect} from './browser-test';
import {readFileSync} from 'node:fs';
import {auditProvider,checked,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';

test('Capacity choices lead to the public map and account sign-in',async({page},info)=>{
  await page.goto('/');
  const choice=page.getByRole('navigation',{name:'Capacity views'});
  await expect(choice.getByRole('link',{name:'Openly shared'})).toHaveAttribute('aria-current','page');
  await expect(page.getByRole('region',{name:'Open transport capacity'})).toBeVisible();
  await page.screenshot({path:info.outputPath('public-capacity.png')});
  await choice.getByRole('link',{name:'Privately shared with you'}).click();
  await expect(page).toHaveURL(/\/login\?from=shared-capacity/);
  await expect(page.getByText('Sign in to see vehicles shared with your account.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Email me a code'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Sign up'})).toBeVisible();
  await expect(page.getByRole('radio',{name:/Shipper|Transport Provider/})).toHaveCount(0);
  await page.screenshot({path:info.outputPath('shared-capacity-sign-in.png')});
  await page.goto('/?view=private&vehicleCategory=Cargo+van');
  await expect(page).toHaveURL(/\/login\?from=shared-capacity/);
});

test('provider Capacity stays public while Network remains a separate task',async({page})=>{
  test.setTimeout(90_000);
  const service=localAuditService(),actor=await auditProvider(service,'capacity-nav');
  try{
  await localSupportLogin(page,actor.id);
  await page.goto('/app/network');
  await expect(page.getByRole('tablist',{name:'Network views'})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Find transport accounts'})).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('navigation',{name:'Capacity views'})).toHaveCount(0);
  // A client redirect may abort the source request before Playwright observes
  // its commit. Verify the destination below even when that exact abort occurs.
  await page.goto('/?view=private',{waitUntil:'commit'}).catch(error=>{
    if(!String(error).includes('net::ERR_ABORTED'))throw error;
  });
  await expect(page).toHaveURL(url=>url.pathname==='/app/home/vehicles'&&!url.search,{timeout:30_000});
  const home=page.getByRole('navigation',{name:'Home views'});
  await expect(home.getByRole('link',{name:'Manage vehicles',exact:true})).toHaveAttribute('aria-current','page');
  await home.getByRole('link',{name:'Analyze the Market',exact:true}).click();
  await expect(page).toHaveURL(url=>url.pathname==='/app/home/market'&&!url.search,{timeout:30_000});
  await expect(home.getByRole('link',{name:'Analyze the Market',exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.getByRole('region',{name:'Public capacity market',exact:true})).toBeVisible();
  await expect(page.getByRole('tablist',{name:'Network views'})).toHaveCount(0);
  const navigation=page.getByRole('navigation',{name:(page.viewportSize()?.width||0)<980?'Mobile navigation':'Site navigation'});
  await navigation.getByRole('link',{name:'Network'}).click();
  await expect(page).toHaveURL(/\/app\/network/,{timeout:30_000});
  }finally{
    if(!page.isClosed())await page.goto('about:blank',{waitUntil:'commit',timeout:5000}).catch(()=>undefined);
    checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));
    checked(await service.auth.admin.deleteUser(actor.id));
  }
});

test('signed-out Privately shared with you entry is readable at narrow phone width in Amharic and Oromo',async({page},info)=>{
  test.setTimeout(90_000);
  await page.setViewportSize({width:320,height:720});
  for(const locale of ['am','om']){
    const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
    await page.goto('/');
    await page.locator('.language-picker select:visible').selectOption(locale);
    const entry=page.locator('.capacity-view-choice a[href="/?view=private"]');
    await expect(entry).toHaveText(messages['Privately shared with you']);
    await entry.click();
    await expect(page).toHaveURL(/\/login\?from=shared-capacity/);
    await expect(page.getByText(messages['Sign in to see vehicles shared with your account.'])).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`shared-sign-in-${locale}.png`)});
  }
});
