import {test,expect} from './browser-test';
const preview=process.env.EXPO_WEB_BASE_URL||'http://localhost:8084';
test('private Capacity keeps its map until explicit sign-in or sign-up and retains the return path',async({page},info)=>{
 test.skip(info.project.name!=='mobile-chromium','Phone-sized Expo entry workflow.');
 test.setTimeout(120_000);
 const errors:string[]=[],privateRequests:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 page.on('request',request=>{const pathname=new URL(request.url()).pathname;if(/^\/api\/(?:mobile\/(?:visitor\/capacity|account-capacity|capacity)(?:\/|$)|business-workspaces\/[^/]+\/capacity(?:\/|$))/.test(pathname))privateRequests.push(pathname);});
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===320?640:844});await page.goto(preview+'/');
  const map=page.locator('.maplibregl-map');await expect(map).toBeVisible({timeout:45_000});const before=await map.boundingBox();expect(before?.height).toBeGreaterThan(250);
  await page.getByRole('tab',{name:'Private Network',exact:true}).click();
  await expect(page).toHaveURL(/\?view=private$/);await expect(page.getByRole('tab',{name:'Private Network',exact:true})).toHaveAttribute('aria-selected','true');
  const heading=page.getByRole('heading',{name:'Private Network',exact:true});await expect(heading).toBeVisible();
  await expect(heading.locator('..').getByText('Sign in to see vehicles your transport partners share with you.',{exact:true})).toBeVisible();
  await expect(map).toBeVisible();const after=await map.boundingBox();expect(after?.height).toBeGreaterThan(250);expect(Math.abs(after!.height-before!.height)).toBeLessThanOrEqual(1);
  await expect(page.locator('[data-marker-id]')).toHaveCount(0);expect(privateRequests).toEqual([]);
  await expect(page.getByRole('link',{name:'Sign in',exact:true})).toHaveAttribute('href','/account?from=capacity');
  const signup=page.getByRole('link',{name:'Sign up',exact:true});await expect(signup).toHaveAttribute('href','/signup?from=capacity&setup=business');
  const signinAction=page.getByRole('link',{name:'Sign in',exact:true});for(const action of[signinAction,signup]){const box=await action.boundingBox();expect(box?.height).toBeGreaterThanOrEqual(44);expect(box?.width).toBeGreaterThanOrEqual(44);await action.click({trial:true});}
  const colors=await signinAction.evaluate(element=>({background:getComputedStyle(element).backgroundColor,color:getComputedStyle(element).color}));expect(colors.background).not.toBe('rgba(0, 0, 0, 0)');expect(colors.background).not.toBe(colors.color);expect(await signup.evaluate(element=>parseFloat(getComputedStyle(element).borderTopWidth))).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`private-entry-map-${width}.png`)});
  await signup.click();await expect(page.getByRole('heading',{name:'Create an account',exact:true})).toBeVisible();
  await expect(page.getByRole('radio',{name:'Plan freight with your transporters',exact:true})).toHaveAttribute('aria-checked','true');
  const signin=page.getByRole('link',{name:'Sign in',exact:true});await expect(signin).toHaveAttribute('href','/account?from=capacity');await signin.click();await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Sign in',exact:true}).locator('..').getByText('Sign in to see vehicles your transport partners share with you.',{exact:true})).toBeVisible();
  await page.goBack();await expect(page.getByRole('heading',{name:'Create an account',exact:true})).toBeVisible();await page.goBack();
  await expect(page).toHaveURL(/\?view=private$/);await expect(heading).toBeVisible();await expect(map).toBeVisible();await expect(page.locator('[data-marker-id]')).toHaveCount(0);expect(privateRequests).toEqual([]);
  await page.getByRole('tab',{name:'Open Market',exact:true}).click();await expect(page.getByRole('tab',{name:'Open Market',exact:true})).toHaveAttribute('aria-selected','true');await expect(map).toBeVisible();
 }
 expect(errors).toEqual([]);
});
