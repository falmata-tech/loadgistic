import {test,expect} from './browser-test';
import {openCapacityFilterDialog} from './capacity-drawer-helper';

test('place keyboard selection preserves the filter form and submits canonical route references only on Show vehicles',async({page})=>{
 test.setTimeout(90000);
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const dialog=await openCapacityFilterDialog(page,'availability');
 await dialog.getByRole('button',{name:'Route',exact:true}).click();
 const origin=dialog.getByRole('combobox',{name:'Origin (optional)',exact:true});
 const initialUrl=page.url();
 const originResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/places'&&new URL(response.url()).searchParams.get('q')==='Addis Ababa');
 await origin.fill('Addis Ababa');
 const originResults=await(await originResponse).json();const originRef=originResults.results[0]?.id;
 expect(typeof originRef).toBe('string');expect(originRef.length).toBeGreaterThan(0);
 await expect(dialog.getByRole('option',{name:/Addis Ababa, Ethiopia/}).first()).toBeVisible();
 await origin.press('ArrowDown');
 const originChoice=await origin.getAttribute('aria-activedescendant');expect(originChoice).toBeTruthy();
 await expect(page.locator(`[id="${originChoice}"]`)).toHaveAttribute('aria-selected','true');
 await origin.press('Enter');
 await expect(dialog).toBeVisible();expect(page.url()).toBe(initialUrl);
 await expect(dialog.locator('input[name="originPlaceRef"]')).toHaveValue(originRef);
 await expect(origin).toHaveValue('Addis Ababa, Ethiopia');await expect(origin).toBeFocused();

 const destination=dialog.getByRole('combobox',{name:'Destination (optional)',exact:true});
 const destinationResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/places'&&new URL(response.url()).searchParams.get('q')==='Assosa');
 await destination.fill('Assosa');const destinationResults=await(await destinationResponse).json();const destinationRef=destinationResults.results[0]?.id;
 expect(typeof destinationRef).toBe('string');expect(destinationRef.length).toBeGreaterThan(0);
 await expect(dialog.getByRole('option',{name:/Assosa/}).first()).toBeVisible();
 await destination.press('Escape');await expect(destination).toHaveAttribute('aria-expanded','false');await expect(dialog).toBeVisible();
 await destination.press('ArrowDown');await expect(destination).toHaveAttribute('aria-expanded','true');await destination.press('Enter');
 await expect(dialog.locator('input[name="destinationPlaceRef"]')).toHaveValue(destinationRef);
 await expect(dialog).toBeVisible();expect(page.url()).toBe(initialUrl);
 // The dialog closes at submit; Next commits the canonical query after its route response.
 await Promise.all([
  page.waitForURL(url=>url.searchParams.get('originPlaceRef')===originRef&&url.searchParams.get('destinationPlaceRef')===destinationRef,{waitUntil:'domcontentloaded'}),
  dialog.getByRole('button',{name:'Show vehicles',exact:true}).click()
 ]);
 await expect(dialog).not.toBeVisible();
 await expect(page).toHaveURL(url=>url.searchParams.get('originPlaceRef')===originRef&&url.searchParams.get('destinationPlaceRef')===destinationRef);
 await page.reload({waitUntil:'domcontentloaded'});await openCapacityFilterDialog(page,'availability');
 await expect(origin).toHaveValue('Addis Ababa, Ethiopia');await expect(destination).toHaveValue('Assosa, Ethiopia');
 await expect(dialog.locator('input[name="originPlaceRef"]')).toHaveValue(originRef);
 await expect(dialog.locator('input[name="destinationPlaceRef"]')).toHaveValue(destinationRef);
 await origin.focus();await expect(origin).toHaveAttribute('aria-expanded','false');
 await origin.press('Escape');await expect(dialog).not.toBeVisible();
 await expect(page).toHaveURL(url=>url.searchParams.get('originPlaceRef')===originRef&&url.searchParams.get('destinationPlaceRef')===destinationRef);
});
