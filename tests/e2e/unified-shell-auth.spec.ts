import {test,expect} from './browser-test';
import {auditProvider,checked,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';

test('one shell gains account navigation after sign-in and returns to Capacity after sign-out',async({page},info)=>{
 test.setTimeout(120_000);
 await page.goto('/');
 const header=page.locator('header.unified-site-header');
 await expect(header.getByRole('link',{name:'Sign in'})).toBeVisible();
 const visitorNavigation=page.getByRole('navigation',{name:info.project.name==='mobile-chromium'?'Mobile navigation':'Site navigation'});
 await expect(visitorNavigation.getByRole('link',{name:'Track',exact:true})).toBeVisible();
 if(info.project.name==='desktop-chromium')await expect(visitorNavigation.getByRole('link',{name:'Capacity'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Network'})).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Switch view'})).toHaveCount(0);
 await page.goto('/login');
 await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Sign up'})).toBeVisible();
 await expect(page.getByRole('radio',{name:/Shipper/})).toHaveCount(0);
 await page.goto('/signup');
 await expect(page.getByRole('heading',{name:'Create an account'})).toBeVisible();
 await expect(page.getByRole('radio',{name:'Find room for your load'})).toBeVisible();
 await expect(page.getByRole('radio',{name:'Put your vehicles on the map'})).toBeVisible();
 const service=localAuditService(),actor=await auditProvider(service,'shell-nav');
 try{
 await localSupportLogin(page,actor.id);
 await page.goto('/');
 await expect(header.locator('summary[aria-label="Account"]')).toBeVisible();
 const accountNavigation=page.getByRole('navigation',{name:info.project.name==='mobile-chromium'?'Mobile navigation':'Site navigation'});
 await expect(accountNavigation.getByRole('link',{name:'Home'})).toHaveCount(1);
 await expect(accountNavigation.getByRole('link',{name:'Capacity'})).toHaveCount(0);
 await expect(accountNavigation.getByRole('link',{name:'Network'})).toHaveCount(1);
 await expect(accountNavigation.getByRole('link',{name:'Shared with you'})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('unified-shell-signed-in.png')});
 await expect(page.getByRole('navigation',{name:'Switch view'})).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Capacity views'})).toHaveCount(0);
 await page.goto('/?view=private');
 await expect(page).toHaveURL(url=>url.pathname==='/'&&!url.search);
 await page.goto('/app/network');
 await expect(page.locator('header.unified-site-header')).toBeVisible();
 await expect(page.locator('.app-topbar')).toHaveCount(0);
 await header.locator('summary[aria-label="Account"]').click();
 await header.getByRole('button',{name:'Log out'}).click();
 await expect(page).toHaveURL(url=>url.pathname==='/',{timeout:30_000});
 await expect(header.getByRole('link',{name:'Sign in'})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Site navigation'}).getByRole('link',{name:'Network'})).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Capacity views'}).getByRole('link',{name:'Shared with you'})).toBeVisible();
 await expect(visitorNavigation.getByRole('link',{name:'Track',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('unified-shell-signed-out.png')});
 }finally{
  await page.goto('about:blank');
  checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));
  checked(await service.auth.admin.deleteUser(actor.id));
 }
});
