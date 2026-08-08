import { test, expect } from '@playwright/test';

async function login(page:any,email:string){
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Loadgistic123!');
  await page.getByRole('button',{name:'Log in'}).click();
  await expect(page).toHaveURL(/\/app\/home/);
}

async function choosePlace(page:any,label:string,query:string,option:RegExp){
  const input=page.getByLabel(label);
  await input.fill(query);
  await expect(page.getByRole('option',{name:option}).first()).toBeVisible();
  await page.getByRole('option',{name:option}).first().click();
}

test('public entry makes capacity immediately usable without an account',async({page}:{page:any})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Trade farther without carrying the full cost of an empty truck.'})).toBeVisible();
  await expect(page.getByRole('link',{name:/Find available capacity/i}).first()).toBeVisible();
  await page.goto('/capacity');
  await expect(page.getByRole('heading',{name:'See who has space before you make the call.'})).toBeVisible();
  await expect.poll(()=>page.locator('.public-capacity-card').count()).toBeGreaterThanOrEqual(14);
  await expect(page.getByText('No capacity-seeker account is required.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Show capacity near me'})).toBeVisible();
});

test('capacity list continues loading and every card reaches a provider page',async({page}:{page:any})=>{
  await page.goto('/capacity');
  await page.getByRole('button',{name:'Load more capacity'}).click();
  await expect.poll(()=>page.locator('.public-capacity-card').count()).toBeGreaterThan(14);
  const card=page.locator('.public-capacity-card').first();
  await expect(card.getByText(/Current radius|Current route/).first()).toBeVisible();
  await expect(card.getByText(/Next trip/).first()).toBeVisible();
  await card.getByRole('link',{name:'Provider details'}).click();
  await expect(page).toHaveURL(/\/providers\//);
  await expect(page.getByRole('heading',{name:'Available capacity'})).toBeVisible();
});

test('map clusters dense capacity and opens the selected full card',async({page}:{page:any})=>{
  await page.goto('/capacity');
  await page.getByRole('button',{name:'Map',exact:true}).click();
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  await expect(page.locator('.capacity-map-cluster,.capacity-truck-map-marker').first()).toBeVisible();
  await page.getByRole('button',{name:'List',exact:true}).click();
  await page.locator('.public-capacity-card').first().getByRole('button',{name:'View on map'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('link',{name:'Provider details'})).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Location privacy');
  await expect(page.locator('.map-location-privacy-circle')).toBeVisible();
  await expect(page.locator('.map-recurring-work-area')).toBeVisible();
  await expect(page.locator('.public-map-legend')).toContainText('Current work radius');
  await expect(page.locator('.public-map-legend')).toContainText('Recurring work area');
});

test('visitor location is manually requested and may be refreshed',async({page,context}:{page:any;context:any})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.74});
  await page.goto('/capacity');
  await page.getByRole('button',{name:'Show capacity near me'}).click();
  await expect(page.getByRole('button',{name:'Refresh my location'})).toBeVisible();
  await expect(page.getByText('Your exact location stays in this browser.')).toBeVisible();
});

test('public directory presents many fleets and owner-operators as full microsites',async({page}:{page:any})=>{
  await page.goto('/providers');
  await expect(page.getByRole('heading',{name:'Find the operator behind the truck.'})).toBeVisible();
  await expect(page.locator('.provider-directory-card')).toHaveCount(30);
  await page.locator('.provider-directory-card').first().getByRole('link',{name:'Visit provider page'}).click();
  await expect(page.locator('.provider-handle')).toContainText('/@');
  await expect(page.getByRole('heading',{name:'Verification evidence'})).toBeVisible();
  await expect(page.getByText(/Confirm current originals/)).toBeVisible();
});

test('provider creates a shipment and receives separate one-time party codes',async({page}:{page:any})=>{
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/provider-shipments/new');
  await page.getByLabel('Truck').selectOption({index:1});
  await page.getByLabel('Cargo summary').fill('Workshop machine parts');
  await choosePlace(page,'Origin','Addis',/Addis Ababa, Ethiopia/i);
  await choosePlace(page,'Destination','Adama',/Adama, Ethiopia/i);
  await page.getByLabel('Shipper email').fill('shipper.e2e@example.test');
  await page.getByLabel('Receiver email').fill('receiver.e2e@example.test');
  await page.getByRole('button',{name:'Create record and codes'}).click();
  await expect(page.getByText('Shipment record created')).toBeVisible();
  const shipperCode=(await page.locator('.party-code-grid article').first().locator('code').textContent())!;
  const receiverCode=(await page.locator('.party-code-grid article').nth(1).locator('code').textContent())!;
  expect(shipperCode).toMatch(/^LG-S-/);expect(receiverCode).toMatch(/^LG-R-/);expect(shipperCode).not.toBe(receiverCode);
  await page.goto('/track');
  await page.getByLabel('Secret shipment code').fill(shipperCode);
  await page.getByRole('button',{name:'Open tracking'}).click();
  await expect(page.getByText('Shipper access')).toBeVisible();
  await expect(page.getByRole('heading',{name:/Track LGX-/})).toBeVisible();
});

test('capacity summary keeps the map visible and focused edits open one section',async({page}:{page:any})=>{
  await login(page,'driver@loadgistic.local');
  await expect(page.getByTestId('capacity-summary')).toBeVisible();
  await expect(page.getByTestId('capacity-summary').locator('.leaflet-container')).toBeVisible();
  await page.getByRole('button',{name:'Location privacy',exact:true}).first().click();
  await expect(page.getByRole('heading',{name:'Location privacy & refresh'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Capacity now'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Available by radius or route'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Refresh current location|Request location permission/})).toBeVisible();
});

test('retired demand URLs redirect to the public supply market',async({page,request}:{page:any;request:any})=>{
  await page.goto('/app/loads');
  await expect(page).toHaveURL(/\/capacity$/);
  await page.goto('/app/network');
  await expect(page).toHaveURL(/\/capacity$/);
  const response=await request.post('/api/shipments',{form:{title:'retired'}});
  expect(response.status()).toBe(410);
});

test('login page never publishes fixture credentials',async({page}:{page:any})=>{
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toHaveValue('');
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page.getByText('@loadgistic.local')).toHaveCount(0);
  await expect(page.getByText('Loadgistic123!',{exact:false})).toHaveCount(0);
});
