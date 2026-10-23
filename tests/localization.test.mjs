import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {LANGUAGES,supportedLocale,translateMessage,translateFeedback} from '../src/lib/i18n/core.js';
import {localizedUpdateLabel} from '../src/lib/i18n/update-label.js';

test('language preference is allowlisted and defaults to English',()=>{
 assert.deepEqual(LANGUAGES.map(l=>l.code),['en','am','om']);
 for(const locale of LANGUAGES)assert.equal(supportedLocale(locale.code),locale.code);
 for(const value of [null,undefined,'AM','../../secret','fr','so','ti','<script>'])assert.equal(supportedLocale(value),'en');
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
test('feedback uses translated known errors and a localized fallback for unexpected server text',()=>{
 const messages={'Could not complete this request. Please try again.':'ጥያቄዎ መፈጸም አልቻለም። እንደገና ይሞክሩ።','Invalid location':'የተሳሳተ አካባቢ'};
 const fallback='Could not complete this request. Please try again.';
 assert.equal(translateFeedback(messages,'am','Invalid location',fallback),'የተሳሳተ አካባቢ');
 assert.equal(translateFeedback(messages,'am','Untranslated GPS vendor detail',fallback),messages[fallback]);
 assert.equal(translateFeedback(messages,'en','Untranslated GPS vendor detail',fallback),'Untranslated GPS vendor detail');
 assert.equal(translateMessage(messages,'A user-written description'),'A user-written description');
});
test('capacity and location freshness labels keep the selected language at all ages',()=>{
 const now=new Date('2026-10-19T12:00:00Z');
 const ages=[0,1,3,5,15,40];
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${locale}.json`,import.meta.url)));
  const t=(key,values)=>translateMessage(messages,key,values);
  for(const kind of ['capacity','location']){
   for(const days of ages){
    const updatedAt=new Date(now.getTime()-days*86400000).toISOString();
    const subject=kind==='location'?'Location':'Capacity';
    const label=days===0?`${subject} updated today`:days<4?`${subject} updated ${days} ${days===1?'day':'days'} ago`:days<8?`${subject} updated within the past week`:days<31?`${subject} updated within the past month`:`${subject} last updated over a month ago`;
    const translated=localizedUpdateLabel(label,t,kind);
    assert.notEqual(translated,label,`${locale} ${kind} ${days}`);
    if(days>0&&days<4)assert.ok(translated.includes(String(days)));
   }
   assert.equal(localizedUpdateLabel(undefined,t,kind),messages[`${kind==='location'?'Location':'Capacity'} update unavailable`]);
  }
 }
});
test('all translated catalogs have matching keys and named placeholders',()=>{
 const catalogs=LANGUAGES.filter(l=>l.code!=='en').map(l=>JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${l.code}.json`,import.meta.url))));
 const keys=Object.keys(catalogs[0]).sort();assert.ok(keys.length>200);
 const variables=text=>[...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(m=>m[1]).sort();
 for(const catalog of catalogs){assert.deepEqual(Object.keys(catalog).sort(),keys);for(const [key,value] of Object.entries(catalog)){assert.equal(typeof value,'string');assert.ok(value.trim(),key);assert.deepEqual(variables(value),variables(key),key);}}
});

test('tracking progression and corrected visible messages have both supported translations',async()=>{
 const {trackingProgress,TRACKING_JOURNEY}=await import('../src/lib/tracking-progress.js');
 const labels=new Set(['Going to pickup','Loading','En route','Unloading','Complete','Problem',
  'Save {status}','Ready to save: {status}','Current: {status}','No available update',
  'Within {distance} km','Page {page} of {pages} · {count} results','{count} active truck','{count} active trucks',
  'Transport services','Verified shipment reviews','Customer experience','New to Loadgistic','No additional stops']);
 for(const current of ['CREATED','ISSUE','CANCELLED',...TRACKING_JOURNEY]){
  for(const status of TRACKING_JOURNEY)for(const recorded of [[],TRACKING_JOURNEY])for(const next of [[],TRACKING_JOURNEY])labels.add(trackingProgress(status,current,recorded,next));
 }
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${locale}.json`,import.meta.url)));
  for(const label of labels){assert.ok(messages[label],`${locale}: ${label}`);assert.notEqual(messages[label],label,`${locale}: ${label}`);}
 }
});

test('launch journeys have contextual messages in every supported non-English locale',()=>{
 const keys=[...JSON.parse(readFileSync(new URL('../resources/i18n/launch-message-keys.json',import.meta.url))),...JSON.parse(readFileSync(new URL('../resources/i18n/featured-review-message-keys.json',import.meta.url)))];
 assert.equal(new Set(keys).size,keys.length);
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${locale}.json`,import.meta.url)));
  for(const key of keys){assert.ok(messages[key]?.trim(),`${locale}: ${key}`);assert.notEqual(messages[key],key,`${locale}: ${key}`);}
  const value='Home · Adama · +251900000001';
  assert.ok(translateMessage(messages,'Oldest request: {time}',{time:value}).includes(value));
 }
});

test('conditional interface labels are checked without translating stored or user content',()=>{
 const audit=spawnSync(process.execPath,['scripts/audit-localization.mjs','--summary'],{encoding:'utf8',maxBuffer:2_000_000});
 assert.equal(audit.status,0,audit.stderr);
 const report=JSON.parse(audit.stdout);
 assert.equal(report.missingCount,0,'marked and conditional UI messages need both catalogs');
 assert.equal(report.unmarkedCount,0,'visible raw JSX copy needs review');
 assert.equal(report.dynamicOwnedMissingCount,0,'literal branches in dynamic UI messages need both catalogs');
 assert.ok(report.dynamicReviewCount>0,'unresolved data/computed boundaries remain visible for manual review');
});
