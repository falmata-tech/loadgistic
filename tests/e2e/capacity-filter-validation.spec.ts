import {test,expect} from '@playwright/test';

test('unresolved locations do not silently broaden the market and can be corrected',async({page}:{page:any})=>{
  await page.goto('/?originPlaceRef=missing-audit-place&origin=Unresolved');
  const notice=page.getByTestId('capacity-feed-state');
  await expect(notice).toContainText('Choose a suggested place');
  await notice.getByRole('button',{name:'Review filters'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const response=await page.request.get('/api/public/capacity?destination=unresolved-audit-city');
  const result=await response.json();
  expect(result.items).toEqual([]);expect(result.hasMore).toBe(false);expect(result.filterError).toContain('Choose a suggested place');
});
