import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {Page} from 'playwright-core';
import {capacityIntroduction,platformAbout} from '../../src/lib/platform-copy.js';

test('capacity networks lead About and both map choices in all five languages',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
  test.setTimeout(120000);
  for(const locale of ['en','am','om','so','ti']){
    const catalog=locale==='en'?{}:JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
    const translated=(message:string)=>catalog[message]||message;
    await page.goto('/');
    const picker=page.locator('.language-picker select:visible');
    await expect(picker).toBeEnabled();await picker.selectOption(locale);
    await expect(page.locator('.market-introduction h1')).toHaveText(translated(capacityIntroduction.title));
    await expect(page.locator('.market-introduction p')).toHaveText(translated(capacityIntroduction.body));
    const choices=page.locator('.capacity-view-choice');
    await expect(choices.getByRole('link',{name:translated('Open to the public'),exact:true})).toHaveAttribute('aria-current','page');
    await choices.getByRole('link',{name:translated('Privately shared with you'),exact:true}).click();
    await expect(page).toHaveURL(/view=private/);
    await expect(page.locator('.market-introduction h1')).toHaveText(translated(capacityIntroduction.title));
    await expect(page.locator('.capacity-view-choice a[aria-current=page]')).toHaveText(translated('Privately shared with you'));
    await page.goto('/about');
    await expect(page.locator('main h1')).toHaveText(translated(platformAbout.title));
    await expect(page.locator('.about-information-grid section h2')).toHaveText(platformAbout.sections.map(([title])=>translated(title)));
    const first=page.locator('.about-information-grid section').first();
    await expect(first.locator('p')).toHaveText(translated(platformAbout.sections[0][1]));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`about-${locale}.png`)});
  }
});
