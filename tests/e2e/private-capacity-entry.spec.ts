import {test,expect} from './browser-test';
import type {Request as PlaywrightRequest} from 'playwright-core';

test('signed-out Private map keeps its tab and opens account access only after an explicit action',async({page,context},info)=>{
 test.setTimeout(90_000);await context.clearCookies();
 const privateRequests:string[]=[];page.on('request',(request:PlaywrightRequest)=>{const path=new URL(request.url()).pathname;if(/^\/api\/(?:business-workspaces\/[^/]+\/capacity|account-capacity|shared-capacity)/.test(path))privateRequests.push(path);});
 await page.goto('/');const views=page.getByRole('navigation',{name:'Capacity views',exact:true});
 await views.getByRole('link',{name:'Privately shared with you',exact:true}).click();
 await expect(page).toHaveURL((url:URL)=>url.pathname==='/'&&url.searchParams.get('view')==='private');
 await expect(views.getByRole('link',{name:'Privately shared with you',exact:true})).toHaveAttribute('aria-current','page');
 const entry=page.getByTestId('private-capacity-entry');
 await expect(entry.getByRole('heading',{name:'Privately shared with you',exact:true})).toBeVisible();
 await expect(entry.getByText('Sign in to see vehicles shared with your account.',{exact:true})).toBeVisible();
 await expect(entry.locator('.leaflet-container')).toBeVisible();await expect(entry.locator('.leaflet-marker-pane>*,.leaflet-overlay-pane>*')).toHaveCount(0);
 await expect(entry.getByRole('link',{name:'Sign in',exact:true})).toHaveAttribute('href','/login?from=shared-capacity');
 await expect(entry.getByRole('link',{name:'Sign up',exact:true})).toHaveAttribute('href','/signup?audience=BUSINESS');
 const geometry=await entry.evaluate((element:HTMLElement)=>{const box=element.getBoundingClientRect(),card=element.querySelector('section')!.getBoundingClientRect(),footer=document.querySelector('.site-copyright')!.getBoundingClientRect();return{height:box.height,centerX:Math.abs(box.x+box.width/2-card.x-card.width/2),centerY:Math.abs(box.y+box.height/2-card.y-card.height/2),footerAfter:footer.top>=box.bottom-1,noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth};});
 expect(geometry.height).toBeGreaterThan(240);expect(geometry.centerX).toBeLessThan(3);expect(geometry.centerY).toBeLessThan(3);expect(geometry.footerAfter).toBe(true);expect(geometry.noHorizontalOverflow).toBe(true);
 expect(privateRequests).toEqual([]);await page.screenshot({path:info.outputPath('signed-out-private-map.png'),fullPage:true});
 await entry.getByRole('link',{name:'Sign up',exact:true}).click();await expect(page).toHaveURL(/\/signup\?audience=BUSINESS$/);
 await expect(page.getByRole('heading',{name:'Create an account',exact:true})).toBeVisible();await expect(page.getByRole('radio',{name:'Find room for your load',exact:true})).toBeChecked();
 await page.goBack();await expect(entry.getByRole('link',{name:'Sign in',exact:true})).toBeVisible();
 await entry.getByRole('link',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/login\?from=shared-capacity$/);
 await expect(page.getByText('Sign in to see vehicles shared with your account.',{exact:true})).toBeVisible();expect(privateRequests).toEqual([]);
});
