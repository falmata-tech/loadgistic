import {test,expect} from './browser-test';
// Read-only local browser coverage; no fixtures, authentication, email or writes.
test('public search metadata and the unified shell preserve useful server HTML',async({page,request})=>{
 const documentResponse=await request.get('/');expect(documentResponse.status()).toBe(200);
 const html=await documentResponse.text();expect(html).toContain('The visibility you need to serve your customers reliably');expect(html).toContain('href="/about"');expect(html).toContain('https://loadgistic.com');
 expect(documentResponse.headers()['x-robots-tag']).toContain('noindex');
 await page.goto('/');const areas=page.getByRole('navigation',{name:(page.viewportSize()?.width||0)>760?'Site navigation':'Mobile navigation'});
 await expect(areas.getByRole('link',{name:'Capacity',exact:true})).toHaveAttribute('aria-current','page');
 await page.getByTestId('public-session-action').getByRole('link',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/login$/);
 await areas.getByRole('link',{name:'Capacity',exact:true}).click();await expect(page).toHaveURL(/\/$/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/?view=private&email=PRIVATE_EMAIL_SENTINEL');await expect(page).toHaveURL(/\/login\?from=shared-capacity/);expect(await page.locator('body').innerText()).not.toContain('PRIVATE_EMAIL_SENTINEL');
 const filtered=await request.get('/?status=EMPTY&q=PRIVATE_QUERY_SENTINEL');expect(filtered.status()).toBe(200);
 const filteredHtml=await filtered.text();expect(filteredHtml).toMatch(/name="robots" content="[^"]*noindex/);expect(filteredHtml).toMatch(/rel="canonical" href="https:\/\/loadgistic\.com\/?"/);
 const sitemap=await request.get('/sitemap.xml');expect(sitemap.status()).toBe(200);expect(await sitemap.text()).not.toContain('<loc>');
 const robots=await request.get('/robots.txt');expect(robots.status()).toBe(200);expect(await robots.text()).toContain('Disallow: /');
 const tracking=await request.get('/track');expect(tracking.status()).toBe(200);expect(tracking.headers()['x-robots-tag']).toContain('noindex');
});
