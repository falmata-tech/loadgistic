import {test,expect} from './browser-test';
import {mkdirSync} from 'node:fs';
const preview=process.env.EXPO_WEB_BASE_URL||'http://localhost:8084';
test('private Capacity explains sign-in and keeps its destination through account creation',async({page},info)=>{
 test.skip(info.project.name!=='mobile-chromium','Phone-sized Expo entry workflow.');
 test.setTimeout(120_000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===320?640:844});await page.goto(preview+'/?view=private');
  await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible({timeout:45_000});
  await expect(page.getByRole('heading',{name:'Sign in',exact:true}).locator('..').getByText('Sign in to see vehicles shared with your account.',{exact:true})).toBeVisible();
  const signup=page.getByRole('link',{name:'Sign up',exact:true});await expect(signup).toHaveAttribute('href','/signup?from=capacity&setup=business');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  mkdirSync('.local/play-code10-20261025/private-entry',{recursive:true});await page.screenshot({path:`.local/play-code10-20261025/private-entry/sign-in-${width}.png`});
  await signup.click();await expect(page.getByRole('heading',{name:'Create an account',exact:true})).toBeVisible();
  await expect(page.getByRole('radio',{name:'Find room for your load',exact:true})).toHaveAttribute('aria-checked','true');
  const signin=page.getByRole('link',{name:'Sign in',exact:true});await expect(signin).toHaveAttribute('href','/account?from=capacity');await signin.click();await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Sign in',exact:true}).locator('..').getByText('Sign in to see vehicles shared with your account.',{exact:true})).toBeVisible();
 }
 expect(errors).toEqual([]);
});
