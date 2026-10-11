import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {capacityIntroduction,platformAbout} from '../src/lib/platform-copy.js';

test('capacity-network explanation is shared across web and native and all interface languages',()=>{
  const messages=[capacityIntroduction.title,capacityIntroduction.body,platformAbout.title,platformAbout.body,...platformAbout.sections.flat()];
  for(const locale of ['am','om','so','ti']){
    const catalog=JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8'));
    for(const message of messages)assert.ok(catalog[message]?.trim()&&catalog[message]!==message,`${locale}: ${message}`);
  }
  for(const file of ['src/app/page.tsx','apps/mobile/src/screens/capacity.tsx']){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    assert.match(source,/capacityIntroduction\.title/);assert.match(source,/capacityIntroduction\.body/);
    assert.match(source,/Open to the public/);assert.match(source,/Privately shared with you/);
  }
  for(const file of ['src/app/about/page.tsx','apps/mobile/src/screens/about.tsx']){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    assert.match(source,/platformAbout\.sections\.map/);
  }
});

test('story leads with the known transporter network and leaves tracking after agreement',()=>{
  assert.match(capacityIntroduction.body,/your transporters/);
  assert.match(capacityIntroduction.body,/space and routes.*public market/);
  assert.match(platformAbout.sections[0][1],/private map.*email.*verify.*reported space.*approximate/);
  assert.match(platformAbout.sections[1][1],/contacts.*everyone.*one recipient/);
  assert.match(platformAbout.sections[2][1],/Filter public capacity.*confirm the job directly/);
  assert.match(platformAbout.sections[3][1],/^Once transport is agreed.*private progress/);
  const copy=JSON.stringify([capacityIntroduction,platformAbout]);
  assert.doesNotMatch(copy,/paid subscription|guaranteed availability|automatic alerts|our fleet/i);
});

test('customer-facing app and campaign copy excludes implementation and priority notes',()=>{
  const listing=JSON.parse(readFileSync(new URL('../resources/marketing/google-play/listing-en-US.json',import.meta.url),'utf8'));
  const campaign=JSON.parse(readFileSync(new URL('../resources/marketing/prelaunch/campaign.json',import.meta.url),'utf8'));
  const customerFields=[capacityIntroduction.title,capacityIntroduction.body,platformAbout.title,platformAbout.body,...platformAbout.sections.flat(),listing.appName,listing.shortDescription,listing.fullDescription,...listing.phoneScreenshots.map(row=>row.title),campaign.profileBio,...campaign.formats.flatMap(row=>[...row.headline,row.status]),...Object.values(campaign.captions).flatMap(row=>Object.values(row))];
  const internalNote=/capacity, routes and availability first|tracking after agreement\.|tracking is secondary|owner approval|release gates|FEAT-[A-Z]|source commit|implementation plan/i;
  for(const text of customerFields)assert.doesNotMatch(text,internalNote);
  assert.match('Capacity, routes and availability first. Tracking after agreement.',internalNote);
});
