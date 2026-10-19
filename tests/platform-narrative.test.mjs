import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {capacityIntroduction,platformAbout} from '../src/lib/platform-copy.js';
const audienceMessages=()=>platformAbout.audiences.flatMap(audience=>[audience.label,audience.heading,audience.action,...audience.facts.flat()]);

test('capacity-network explanation is shared across web and native and all interface languages',()=>{
  const messages=[capacityIntroduction.title,capacityIntroduction.body,platformAbout.title,platformAbout.body,...audienceMessages()];
  for(const locale of ['am','om']){
    const catalog=JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8'));
    for(const message of messages)assert.ok(catalog[message]?.trim()&&catalog[message]!==message,`${locale}: ${message}`);
  }
  for(const file of ['src/app/page.tsx','apps/mobile/src/screens/capacity.tsx']){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    assert.match(source,/capacityIntroduction\.title/);assert.match(source,/capacityIntroduction\.body/);
    assert.match(source,/Open to the public/);assert.match(source,/Privately shared with you/);
  }
  for(const file of ['src/components/about-audiences.tsx','apps/mobile/src/screens/about.tsx']){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    assert.match(source,/platformAbout\.audiences\.map/);
  }
});

test('story leads with the known transporter network and leaves tracking after agreement',()=>{
  assert.match(capacityIntroduction.body,/your transporters/);
  assert.match(capacityIntroduction.body,/space and routes.*public market/);
  assert.deepEqual(platformAbout.audiences.map(audience=>audience.id),['shipping','individual','company']);
  assert.match(platformAbout.audiences[0].facts[0][1],/email.*Verify.*space.*routes.*approximate/);
  assert.match(platformAbout.audiences[1].facts[1][1],/contacts.*public.*both.*one recipient/);
  assert.match(platformAbout.audiences[0].facts[1][1],/Filter public capacity.*confirm the job/);
  assert.match(platformAbout.audiences[0].facts[2][1],/^For agreed shipments.*private progress/);
  const copy=JSON.stringify([capacityIntroduction,platformAbout]);
  assert.doesNotMatch(copy,/paid subscription|guaranteed availability|automatic alerts|\bour fleet\b/i);
});

test('customer-facing app and campaign copy excludes implementation and priority notes',()=>{
  const listing=JSON.parse(readFileSync(new URL('../resources/marketing/google-play/listing-en-US.json',import.meta.url),'utf8'));
  const campaign=JSON.parse(readFileSync(new URL('../resources/marketing/prelaunch/campaign.json',import.meta.url),'utf8'));
  const customerFields=[capacityIntroduction.title,capacityIntroduction.body,platformAbout.title,platformAbout.body,...audienceMessages(),listing.appName,listing.shortDescription,listing.fullDescription,...listing.phoneScreenshots.map(row=>row.title),campaign.profileBio,...campaign.formats.flatMap(row=>[...row.headline,row.status]),...Object.values(campaign.captions).flatMap(row=>Object.values(row))];
  const internalNote=/capacity, routes and availability first|tracking after agreement\.|tracking is secondary|owner approval|release gates|FEAT-[A-Z]|source commit|implementation plan/i;
  for(const text of customerFields)assert.doesNotMatch(text,internalNote);
  assert.match('Capacity, routes and availability first. Tracking after agreement.',internalNote);
});
