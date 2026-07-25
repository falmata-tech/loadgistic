import { test, expect } from '@playwright/test';

async function login(page: any, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Loadgistic123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/app\/home/);
}

test('login keeps local fixture credentials out of the public page', async ({ page }: { page: any }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toHaveValue('');
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page.getByText('@loadgistic.local')).toHaveCount(0);
  await expect(page.getByText('Loadgistic123!', { exact: false })).toHaveCount(0);
});

test('authenticated company browsing preserves the session and selected provider', async ({ page }: { page: any }) => {
  await login(page, 'shipper@loadgistic.local');
  await page.goto('/app/providers');
  await page.getByRole('link', { name: 'View company' }).first().click();
  await expect(page.getByTestId('public-session-action')).toHaveText('Workspace');
  await expect(page.getByRole('link', { name: 'Login' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Send business request' }).click();
  await expect(page).toHaveURL(/\/app\/shipments\/new\?provider=/);
  await expect(page.getByRole('combobox', { name: 'Selected provider' })).not.toHaveValue('');
  await page.goto('/app/providers?type=DRIVER');
  await page.getByRole('link', { name: 'View company' }).click();
  await page.getByRole('link', { name: 'Send business request' }).click();
  await expect(page.getByRole('combobox', { name: 'Selected provider' })).toHaveValue('profile:provider-driver');
  await page.goto('/login');
  await expect(page).toHaveURL(/\/app\/home/);
});

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

test('browse-only provider cannot see party controls or unrelated saved loads', async ({ page }: { page: any }) => {
  await login(page, 'driver@loadgistic.local');
  await page.goto('/app/loads');
  await expect(page.getByText('Packaged food to Hawassa')).toHaveCount(0);
  await page.goto('/app/shipments/shp-freight-fixed');
  await expect(page.getByRole('heading', { name: 'Interested in this load?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Internal note' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Next status' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Upload proof' })).toHaveCount(0);
});
