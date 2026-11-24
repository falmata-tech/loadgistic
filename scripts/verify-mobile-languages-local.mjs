import assert from 'node:assert/strict';
import {mkdirSync, readFileSync} from 'node:fs';
import {chromium, devices} from 'playwright';
import {LANGUAGES} from '../src/lib/i18n/core.js';
import {nativeMessages} from '../apps/mobile/src/localization/messages.ts';

const root = new URL('../', import.meta.url);
const base = new URL(process.env.EXPO_PREVIEW_URL || 'http://localhost:8084');
assert.ok(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname), 'Use a local Expo preview.');
const captures = new URL('.local/mobile-language-review/', root);
mkdirSync(captures, {recursive: true});

const catalogs = Object.fromEntries(LANGUAGES.map(({code}) => {
  if (code === 'en') return [code, {}];
  const shared = JSON.parse(readFileSync(new URL(`src/lib/i18n/messages/${code}.json`, root), 'utf8'));
  return [code, {...shared, ...nativeMessages[code]}];
}));
const translated = (code, message) => catalogs[code][message] || message;

const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const page = await browser.newPage({...devices['Pixel 7'], viewport: {width: 320, height: 844}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.name));
  await page.goto(new URL('/account', base).href, {waitUntil: 'domcontentloaded', timeout: 90000});
  await page.getByRole('button', {name: 'Send code', exact: true}).waitFor({timeout: 60000});
  let current = 'en';
  for (const {code, name} of LANGUAGES) {
    await page.getByRole('button', {name: translated(current, 'Language'), exact: true}).click();
    const menu = page.getByRole('dialog');
    const choice = menu.getByRole('radio', {name, exact: true});
    await choice.waitFor();
    assert.equal(await menu.getByRole('radio').count(), LANGUAGES.length);
    if (code !== current) await choice.click();
    await page.screenshot({path: new URL(`menu-${code}.png`, captures).pathname});
    await menu.getByRole('button').first().click();
    const sendCode = page.getByRole('button', {name: translated(code, 'Send code'), exact: true});
    assert.ok(catalogs[code]['Send code'] || code === 'en', `Missing sign-in copy for ${code}`);
    await sendCode.waitFor();
    await page.reload({waitUntil: 'domcontentloaded'});
    await sendCode.waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), code);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({path: new URL(`account-${code}.png`, captures).pathname});
    current = code;
  }
  await page.getByRole('tab', {name: translated(current, 'Track'), exact: true}).click();
  await page.getByRole('heading', {name: translated(current, 'Follow your shipment'), exact: true}).waitFor();
  await page.getByRole('button', {name: translated(current, 'Open tracking'), exact: true}).waitFor();
  await page.screenshot({path: new URL(`tracking-${current}.png`, captures).pathname});
  assert.deepEqual(errors, []);
  console.log(`Verified all ${LANGUAGES.length} languages in a 320px Chrome phone viewport. Sign-in copy persisted after reload, and Tracking opened in the last selected language.`);
} finally {
  await browser.close();
}
