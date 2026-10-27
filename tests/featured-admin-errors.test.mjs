import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {errorMessage} from '../src/lib/errors.ts';

test('Featured schedule denials tell staff the evening window and minimum provider time',()=>{
 const window=errorMessage(Error('FEATURED_SCHEDULE_WINDOW_INVALID'));
 const outside=errorMessage(Error('FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION'));
 const short=errorMessage(Error('FEATURED_MANUAL_SCHEDULE_TOO_SHORT'));
 assert.match(window,/10:30PM.*11:59PM EAT/);
 assert.match(outside,/10:30PM.*11:59PM EAT/);
 assert.match(short,/10 minutes/);
 for(const message of [window,outside,short,errorMessage(Error('FEATURED_SCHEDULE_CAPACITY_EXCEEDED'))])assert.doesNotMatch(message,/morning|08:30|12:00/i);
});

test('the new Featured schedule denials are translated without losing the time or duration',()=>{
 const messages=['FEATURED_SCHEDULE_WINDOW_INVALID','FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION','FEATURED_MANUAL_SCHEDULE_TOO_SHORT'];
 for(const language of ['am','om']){
  const catalog=JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${language}.json`,import.meta.url),'utf8'));
  for(const code of messages){const english=errorMessage(Error(code)),translated=catalog[english];assert.equal(typeof translated,'string',`${language}: ${code}`);assert.notEqual(translated,english);assert.match(translated,code==='FEATURED_MANUAL_SCHEDULE_TOO_SHORT'?/10/:/10:30PM.*11:59PM EAT/);}
 }
});
