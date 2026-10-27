import {test,expect} from './browser-test';
import {readFileSync} from 'node:fs';
import type {Page} from 'playwright-core';
import {capacityIntroduction,platformAbout} from '../../src/lib/platform-copy.js';

test.use({trace:'off'});

test('capacity networks lead About and both map choices in all three supported languages',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
  test.setTimeout(120000);
  for(const locale of ['en','am','om']){
    const catalog=locale==='en'?{}:JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
    const translated=(message:string)=>catalog[message]||message;
    await page.goto('/');
    const picker=page.locator('.language-picker select:visible');
    await expect(picker).toBeEnabled();await picker.selectOption(locale);
    await expect(page.locator('.market-introduction h1')).toHaveText(translated(capacityIntroduction.title));
    await expect(page.locator('.market-introduction p')).toHaveCount(1);
    await expect(page.locator('.market-introduction p')).toHaveText(translated(capacityIntroduction.webDescription));
    const choices=page.locator('.capacity-view-choice');
    await expect(choices.getByRole('link',{name:translated('Openly shared'),exact:true})).toHaveAttribute('aria-current','page');
    await choices.getByRole('link',{name:translated('Privately shared with you'),exact:true}).click();
    await expect(page).toHaveURL(/\/login\?from=shared-capacity/);
    await expect(page.getByRole('heading',{name:translated('Sign in'),exact:true})).toBeVisible();
    await expect(page.getByText(translated('Sign in to see vehicles shared with your account.'),{exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:translated('Sign up'),exact:true})).toHaveAttribute('href','/signup');
    await page.goto('/about');
    await expect(page.locator('main h1')).toHaveText(translated(platformAbout.title));
    for(const audience of platformAbout.audiences){
      await page.getByRole('tab',{name:translated(audience.label),exact:true}).click();
      const panel=page.getByRole('tabpanel');
      await expect(panel.getByRole('heading',{level:2})).toHaveText(translated(audience.heading));
      await expect(panel.locator('li h3')).toHaveText(audience.facts.map(([title])=>translated(title)));
      await expect(panel.getByRole('link',{name:translated(audience.action),exact:true})).toHaveAttribute('href',audience.href);
    }
    await page.getByRole('tab',{name:translated(platformAbout.audiences[0].label),exact:true}).click();
    await expect(page.getByRole('link',{name:translated('Account and data deletion'),exact:true})).toHaveAttribute('href','/delete-account');
    const footer=page.locator('body>.site-copyright');
    await expect(footer).toContainText(translated('Jigjiga, Somali Region, Ethiopia'));
    await expect(footer).toContainText(`© ${new Date().getFullYear()} MarketVision Technology`);
    await expect(footer.getByRole('link',{name:'MarketVision Technology'})).toHaveAttribute('href','https://marketvisiontech.com/');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`about-${locale}.png`)});
    await footer.getByRole('link',{name:'MarketVision Technology'}).scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`about-footer-${locale}.png`)});
  }
});

test('About audience tabs work by keyboard and keep policy destinations',async({page}:{page:Page})=>{
  await page.goto('/about');
  const tabs=page.getByRole('tablist',{name:'About Loadgistic'});
  const first=tabs.getByRole('tab',{name:'Brokers & shippers',exact:true});
  await first.focus();await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab',{name:'Drivers & owners',exact:true})).toBeFocused();
  await expect(page.getByRole('tabpanel').getByRole('heading',{level:2})).toHaveText(platformAbout.audiences[1].heading);
  await page.keyboard.press('End');
  await expect(tabs.getByRole('tab',{name:'Transport companies',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('link',{name:'Account and data deletion',exact:true})).toHaveAttribute('href','/delete-account');
  await expect(page.getByRole('link',{name:'Terms',exact:true}).last()).toHaveAttribute('href','/terms');
});

test('native About stays audience-led in three supported languages and preserves reviewer login',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
  test.setTimeout(120000);
  const names:Record<string,string>={en:'English',am:'አማርኛ',om:'Afaan Oromo'};
  let previous:Record<string,string>={};
  const translated=(catalog:Record<string,string>,message:string)=>catalog[message]||message;
  await page.goto('http://localhost:8084/account');
  await page.getByRole('link',{name:'Review access',exact:true}).click();
  await expect(page).toHaveURL(/\/review-access$/);
  await expect(page.getByLabel('Review account email',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Review account password',{exact:true})).toBeVisible();
  await page.goto('http://localhost:8084/about');
  for(const locale of ['en','am','om']){
    const catalog=locale==='en'?{}:JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
    await page.getByRole('button',{name:translated(previous,'Language'),exact:true}).click();
    await page.getByRole('radio',{name:names[locale],exact:true}).click();
    await page.getByRole('dialog').getByRole('button').click();
    await expect(page.getByRole('heading',{name:translated(catalog,platformAbout.title),exact:true})).toBeVisible();
    for(const audience of platformAbout.audiences){
      await page.getByRole('button',{name:translated(catalog,audience.label),exact:true}).click();
      await expect(page.getByRole('heading',{name:translated(catalog,audience.heading),exact:true})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    await page.getByRole('button',{name:translated(catalog,platformAbout.audiences[0].label),exact:true}).click();
    await expect(page.getByRole('link',{name:translated(catalog,'App review access'),exact:true})).toHaveCount(0);
    await expect(page.getByText(translated(catalog,'Jigjiga, Somali Region, Ethiopia'),{exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'MarketVision Technology'})).toBeVisible();
    await page.screenshot({path:info.outputPath(`native-about-${locale}.png`)});
    await page.getByRole('link',{name:'MarketVision Technology'}).scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`native-about-footer-${locale}.png`)});
    previous=catalog;
  }
});
