import { test, expect } from '@playwright/test';

async function login(page: any, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Loadgistic123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/app\/home/);
}

test('shipper can open new shipment workflow', async ({ page }: { page: any }) => {
  await login(page, 'shipper@loadgistic.local');
  await page.getByRole('link', { name: /Create shipment/i }).click();
  await expect(page.getByRole('heading', { name: 'New B2B shipment' })).toBeVisible();
});

test('parcel operator can use manual code lookup', async ({ page }: { page: any }) => {
  await login(page, 'parcel@loadgistic.local');
  await page.goto('/app/shipments');
  await page.getByPlaceholder(/Enter shipment code/i).fill('LGX-P1001');
  await page.getByRole('button', { name: 'Look up' }).click();
  await expect(page.getByText('LGX-P1001')).toBeVisible();
});

test('transporter sees load and capacity pages', async ({ page }: { page: any }) => {
  await login(page, 'transporter@loadgistic.local');
  await page.goto('/app/loads');
  await expect(page.getByRole('heading', { name: 'Find B2B loads' })).toBeVisible();
  await page.goto('/app/capacity');
  await expect(page.getByRole('heading', { name: 'Truck capacity' })).toBeVisible();
});
