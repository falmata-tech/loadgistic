import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LANGUAGES,supportedLocale,translateMessage} from '../src/lib/i18n/core.js';

test('language preference is allowlisted and defaults to English',()=>{
 assert.deepEqual(LANGUAGES.map(l=>l.code),['en','am','om','so','ti']);
 for(const locale of LANGUAGES)assert.equal(supportedLocale(locale.code),locale.code);
 for(const value of [null,undefined,'AM','../../secret','fr','<script>'])assert.equal(supportedLocale(value),'en');
});
test('catalog fallback and named values preserve content without recursive translation',()=>{
 const messages={Home:'መነሻ','Hello {name}':'ሰላም {name}',Blank:'',Spaces:'  '};
 assert.equal(translateMessage(messages,' Home '),' መነሻ ');
 assert.equal(translateMessage(messages,'Missing'),'Missing');
 assert.equal(translateMessage(messages,'Blank'),'Blank');
 assert.equal(translateMessage(messages,'Spaces'),'Spaces');
 assert.equal(translateMessage(messages,'Hello {name}',{name:'Home'}),'ሰላም Home');
 assert.equal(translateMessage(messages,'Hello {name}',{name:'<script>alert(1)</script>'}),'ሰላም <script>alert(1)</script>');
 assert.equal(translateMessage(messages,'Hello {name}'),'ሰላም {name}');
 assert.equal(translateMessage(messages,'toString'),'toString');
});
test('all translated catalogs have matching keys and named placeholders',()=>{
 const catalogs=LANGUAGES.filter(l=>l.code!=='en').map(l=>JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${l.code}.json`,import.meta.url))));
 const keys=Object.keys(catalogs[0]).sort();assert.ok(keys.length>200);
 const variables=text=>[...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(m=>m[1]).sort();
 for(const catalog of catalogs){assert.deepEqual(Object.keys(catalog).sort(),keys);for(const [key,value] of Object.entries(catalog)){assert.equal(typeof value,'string');assert.ok(value.trim(),key);assert.deepEqual(variables(value),variables(key),key);}}
});

test('tracking progression and corrected visible messages have all four translations',async()=>{
 const {trackingProgress,TRACKING_JOURNEY}=await import('../src/lib/tracking-progress.js');
 const labels=new Set(['Going to pickup','Loading','En route','Unloading','Complete','Problem',
  'Save {status}','Ready to save: {status}','Current: {status}','No available update',
  'Within {distance} km','Page {page} of {pages} · {count} results','{count} active truck','{count} active trucks',
  'Transport services','Verified shipment reviews','Customer experience','New to Loadgistic']);
 for(const current of ['CREATED','ISSUE','CANCELLED',...TRACKING_JOURNEY]){
  for(const status of TRACKING_JOURNEY)for(const recorded of [[],TRACKING_JOURNEY])for(const next of [[],TRACKING_JOURNEY])labels.add(trackingProgress(status,current,recorded,next));
 }
 for(const locale of ['am','om','so','ti']){
  const messages=JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${locale}.json`,import.meta.url)));
  for(const label of labels){assert.ok(messages[label],`${locale}: ${label}`);assert.notEqual(messages[label],label,`${locale}: ${label}`);}
 }
});
