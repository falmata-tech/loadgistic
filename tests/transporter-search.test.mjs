import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transporterSearchQuery,TRANSPORTER_SEARCH_DELAY_MS,TRANSPORTER_SEARCH_TIMEOUT_MS} from '../src/lib/transporter-search.js';

test('live search avoids empty and single-character queries, including Unicode',()=>{
 for(const value of [null,undefined,{},'', '  ', 'a','  ሀ  ','🚚'])assert.equal(transporterSearchQuery(value),null);
 for(const value of ['  ab  ','አጓ','Borama','🚚🚛'])assert.equal(transporterSearchQuery(value),value.trim());
});
test('live search retains the existing120-character server bound',()=>{
 assert.equal(transporterSearchQuery('a'.repeat(120)),'a'.repeat(120));
 assert.equal(transporterSearchQuery('a'.repeat(121)),null);
 assert.equal(transporterSearchQuery('🚚'.repeat(61)),null);
 assert.equal(TRANSPORTER_SEARCH_DELAY_MS,500);
 assert.equal(TRANSPORTER_SEARCH_TIMEOUT_MS,15000);
});
test('transporter search and short-input controls have both supported translations',()=>{
 for(const language of ['am','om']){
  const catalog=JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${language}.json`,import.meta.url),'utf8'));
  for(const key of ['Transporter search','Close transporter search','Enter at least two characters.','Clear search','Finding transporters','No transporters match this search. Try another name, city or service.','No truck signals match these filters. Adjust the filters or check again later.'])assert.ok(catalog[key]?.trim()&&catalog[key]!==key,`${language}: ${key}`);
 }
});
