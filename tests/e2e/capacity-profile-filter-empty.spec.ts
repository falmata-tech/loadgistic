import {test,expect} from './browser-test';

const selected='audit-no-such-provider';

test('an empty selected-profile map offers the retained vehicle filters on web and Expo',async({page},info)=>{
 test.setTimeout(90000);
 if(info.project.name==='mobile-chromium'){
  await page.goto(`http://127.0.0.1:8084/?provider=${selected}`);
  await page.getByRole('button',{name:'Vehicle filters',exact:true}).click();
  await page.getByRole('checkbox',{name:'Empty vehicle',exact:true}).check();
  await page.getByRole('button',{name:'Show vehicles',exact:true}).click();
  await expect(page.getByText('No matching available vehicles.',{exact:true})).toBeVisible({timeout:45000});
  await expect(page.getByText('No vehicles are shared with this account yet.',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Review filters'}).click();
  await expect(page.getByText('Showing selected profile vehicles',{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('expo-profile-empty-review.png')});
  return;
 }
 await page.goto(`/?provider=${selected}&status=EMPTY`);
 const notice=page.getByTestId('capacity-feed-state');
 await expect(notice).toContainText('No matching available vehicles.',{timeout:30000});
 await expect(notice).not.toContainText('No vehicles are shared with this account yet.');
 await notice.getByRole('button',{name:'Review filters'}).click();
 const filters=page.getByRole('dialog',{name:'Vehicle filters',exact:true});
 await expect(filters).toBeVisible();
 await expect(filters.locator('input[type="hidden"][name="status"]')).toHaveValue('EMPTY');
 expect(new URL(page.url()).searchParams.get('provider')).toBe(selected);
 await page.screenshot({path:info.outputPath('web-profile-empty-review.png')});
});
