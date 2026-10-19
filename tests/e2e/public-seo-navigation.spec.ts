import {test,expect} from './browser-test';
// Read-only local browser coverage; no fixtures, authentication, email or writes.
test('public search metadata and the common area switch preserve useful server HTML',async({page,request})=>{
 const documentResponse=await request.get('/');expect(documentResponse.status()).toBe(200);
 const html=await documentResponse.text();expect(html).toContain('Find space for your next load');expect(html).toContain('href="/about"');expect(html).toContain('https://loadgistic.com');
 expect(documentResponse.headers()['x-robots-tag']).toContain('noindex');
 await page.goto('/');const areas=page.getByRole('navigation',{name:'Switch view'});
 await expect(areas.getByText('Marketplace',{exact:true})).toHaveAttribute('aria-current','page');
 await expect(areas.getByRole('link',{name:'My workspace',exact:true})).toHaveAttribute('href','/login');
 await areas.getByRole('link',{name:'My workspace',exact:true}).click();await expect(page).toHaveURL(/\/login$/);
 await expect(areas.getByText('My workspace',{exact:true})).toHaveAttribute('aria-current','page');
 await areas.getByRole('link',{name:'Marketplace',exact:true}).click();await expect(page).toHaveURL(/\/$/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const privateEntry=await request.get('/?view=private&email=PRIVATE_EMAIL_SENTINEL');expect(privateEntry.status()).toBe(200);
 const privateHtml=await privateEntry.text();expect(privateHtml).toMatch(/name="robots" content="[^"]*noindex/);expect(privateEntry.headers()['x-robots-tag']).toContain('noindex');
 const filtered=await request.get('/?status=EMPTY&q=PRIVATE_QUERY_SENTINEL');expect(filtered.status()).toBe(200);
 const filteredHtml=await filtered.text();expect(filteredHtml).toMatch(/name="robots" content="[^"]*noindex/);expect(filteredHtml).toMatch(/rel="canonical" href="https:\/\/loadgistic\.com\/?"/);
 const sitemap=await request.get('/sitemap.xml');expect(sitemap.status()).toBe(200);expect(await sitemap.text()).not.toContain('<loc>');
 const robots=await request.get('/robots.txt');expect(robots.status()).toBe(200);expect(await robots.text()).toContain('Disallow: /');
 const tracking=await request.get('/track');expect(tracking.status()).toBe(200);expect(tracking.headers()['x-robots-tag']).toContain('noindex');
});
