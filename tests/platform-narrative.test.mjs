import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {capacityIntroduction,platformAbout,signupBenefits} from '../src/lib/platform-copy.js';
import {loadEffectiveWebCatalogs} from '../scripts/lib/effective-i18n-catalogs.mjs';
const audienceMessages=()=>platformAbout.audiences.flatMap(audience=>[audience.label,audience.heading,audience.action,...audience.facts.flat()]);

test('brief capacity heading and the fuller About story are localized across web and native',async()=>{
  const catalogs=await loadEffectiveWebCatalogs();
  const messages=[capacityIntroduction.title,capacityIntroduction.webDescription,platformAbout.title,platformAbout.body,...audienceMessages(),...signupBenefits.business,...signupBenefits.provider,'See how Loadgistic works','Plan freight with your transporters','Manage vehicles and share capacity','Work with your transporters','See the capacity your transporters share and follow shipments with your team.'];
  for(const locale of ['am','om']){
    const catalog=catalogs[locale];
    for(const message of messages)assert.ok(catalog[message]?.trim()&&catalog[message]!==message,`${locale}: ${message}`);
  }
  for(const file of ['src/app/page.tsx','apps/mobile/src/screens/capacity.tsx']){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    assert.match(source,/capacityIntroduction\.title/);assert.doesNotMatch(source,/capacityIntroduction\.body/);
    assert.match(source,/Open Market/);assert.match(source,/Private Network/);
  }
  for(const file of ['src/components/about-audiences.tsx','apps/mobile/src/screens/about.tsx']){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    assert.match(source,/platformAbout\.audiences\.map/);
  }
});

test('signup benefits match the actual two account jobs across web and native',()=>{
  assert.equal(signupBenefits.business.length,3);
  assert.equal(signupBenefits.provider.length,3);
  assert.match(signupBenefits.business.join(' '),/your transporters share.*Private Network.*agreed shipments.*Open Market/i);
  assert.match(signupBenefits.provider.join(' '),/one vehicle.*permission to operate.*available space.*phone location.*GPS/i);
  for(const file of ['src/app/signup/page.tsx','apps/mobile/src/screens/account.tsx']){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    assert.match(source,/signupBenefits/);
    assert.match(source,/See how Loadgistic works/);
  }
});

test('the homepage leads with network coordination and About explains each audience’s work',()=>{
  assert.equal(capacityIntroduction.title,'Work better with transporters to serve your customers');
  assert.match(capacityIntroduction.webDescription,/Transporters manage their vehicles and drivers.*Their updates show which vehicles have room and where they plan to go.*cost-effective shipments/i);
  assert.deepEqual(platformAbout.audiences.map(audience=>audience.id),['shipping','individual','company']);
  assert.match(platformAbout.audiences[0].facts[2][1],/Open Market.*route.*vehicle type.*Confirm availability/);
  assert.match(platformAbout.audiences[0].facts[0][1],/shares a vehicle with your business.*authorized teammates.*Private Network/);
  assert.match(platformAbout.audiences[0].facts[1][1],/Brokers.*expiring tracking link and code/);
  assert.match(platformAbout.audiences[1].facts[0][1],/available space.*routes.*permission to operate/);
  const gpsCopy=platformAbout.audiences[2].facts[1][1];
  assert.match(gpsCopy,/phone location.*compatible GPS tracker/);
  assert.doesNotMatch(gpsCopy,/\bManual\b/i);
  assert.match(platformAbout.audiences[2].facts[0][1],/Assign drivers.*publish vehicle availability.*preferred routes/);
  assert.match(platformAbout.audiences[2].facts[2][1],/private tracking once the work is agreed/);
  for(const entry of platformAbout.audiences.slice(1))assert.equal(entry.href,'/signup?audience=PROVIDER');
  const copy=JSON.stringify([capacityIntroduction,platformAbout]);
  assert.doesNotMatch(copy,/paid subscription|guaranteed availability|automatic alerts|\bour fleet\b/i);
});

test('customer-facing app and campaign copy excludes implementation and priority notes',()=>{
  const listing=JSON.parse(readFileSync(new URL('../resources/marketing/google-play/listing-en-US.json',import.meta.url),'utf8'));
  const campaign=JSON.parse(readFileSync(new URL('../resources/marketing/prelaunch/campaign.json',import.meta.url),'utf8'));
  assert.equal(campaign.coreMessage,`${capacityIntroduction.title}.`);
  assert.equal(listing.shortDescription,campaign.coreMessage);
  assert.ok(listing.fullDescription.startsWith(capacityIntroduction.webDescription+'\n\n'));
  const customerFields=[capacityIntroduction.title,platformAbout.title,platformAbout.body,...audienceMessages(),listing.appName,listing.shortDescription,listing.fullDescription,...listing.phoneScreenshots.map(row=>row.title),campaign.profileBio,...campaign.formats.flatMap(row=>[...row.headline,row.status]),...Object.values(campaign.captions).flatMap(row=>Object.values(row))];
  const internalNote=/capacity, routes and availability first|tracking after agreement\.|tracking is secondary|owner approval|release gates|FEAT-[A-Z]|source commit|implementation plan/i;
  for(const text of customerFields)assert.doesNotMatch(text,internalNote);
  assert.match('Capacity, routes and availability first. Tracking after agreement.',internalNote);
});
