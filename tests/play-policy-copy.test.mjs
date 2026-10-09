import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {privacyContact,privacySections} from '../src/lib/privacy-copy.js';
test('all shared privacy sections and critical conditional controls have four native-language versions',()=>{
 const messages=[...privacySections.flat(),"Only an approximate location, within your chosen radius of up to 20 km, is sent to Loadgistic and shared with authorized shipment parties. Your exact coordinates stay on your phone.",'Open demo shipment tracking','Open demo private capacity','Verify another account','Deletion completed','Deletion in progress','Action needed before deletion','Deletion request received','The terms could not be loaded. Try again.','The terms could not be accepted. Try again.'];
 for(const locale of ['am','om','so','ti']){const catalog=JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8'));for(const message of messages)assert.ok(typeof catalog[message]==='string'&&catalog[message].trim()&&catalog[message]!==message,`${locale}: ${message}`);}
 assert.equal(privacyContact,'marketvision.tech@gmail.com');
});
