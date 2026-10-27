import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FEATURED_PUBLIC_HEADING,curatedFeaturedHeadline,curatedFeaturedIntroduction} from '../src/lib/featured-heading-presentation.js';

test('Featured identifies the TikTok LIVE programme without repeating a generic saved headline',()=>{
 assert.equal(FEATURED_PUBLIC_HEADING,'Daily Featured on TikTok LIVE');
 for(const value of ['',null,'Daily Featured Transport Providers',' daily featured on tiktok live '])assert.equal(curatedFeaturedHeadline(value),'');
 assert.equal(curatedFeaturedHeadline('Highland freight tonight'),'Highland freight tonight');
});

test('Featured omits stock introductory narration but preserves a distinct saved day introduction',()=>{
 for(const value of ['',null,'Meet the transport accounts in today’s showcase.','Meet the transport accounts in today’s showcase and explore the vehicles they publish.'])assert.equal(curatedFeaturedIntroduction(value),'');
 assert.equal(curatedFeaturedIntroduction('  These accounts serve tonight’s northern corridor.  '),'These accounts serve tonight’s northern corridor.');
});

test('Amharic and Oromo name the same public TikTok LIVE programme',()=>{
 for(const language of ['am','om']){const catalog=JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${language}.json`,import.meta.url),'utf8'));assert.match(catalog[FEATURED_PUBLIC_HEADING],/TikTok LIVE/);assert.notEqual(catalog[FEATURED_PUBLIC_HEADING],FEATURED_PUBLIC_HEADING);}
});
