import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const {tables}=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url)));
const fleets=Array.from({length:8},(_,index)=>`org-public-fleet-0${index+1}`);
const pages=fleets.map(id=>{
 const organization=tables.organizations.find(row=>row.id===id);
 const page=tables.company_pages.find(row=>row.organization_id===id);
 const vehicles=tables.vehicles.filter(row=>row.organization_id===id&&row.active);
 const routes=tables.profile_routes.filter(row=>row.organization_id===id);
 assert.ok(organization&&page&&vehicles.length&&routes.length,id);
 return {organization,page,vehicles,routes};
});

test('eight public demo fleets have concise, distinct copy supported by their routes and vehicles',()=>{
 assert.equal(new Set(pages.map(({page})=>page.headline)).size,8);
 assert.equal(new Set(pages.map(({page})=>page.about)).size,8);
 for(const {organization,page,vehicles,routes} of pages){
  assert.equal(page.published,1);
  assert.ok(page.headline.length>=15&&page.headline.length<=55,organization.id);
  assert.ok(page.about.length>=70&&page.about.length<=190,organization.id);
  assert.ok(page.about.trim().split(/\s+/).length<=30,organization.id);
  assert.ok(page.about.includes(organization.name),organization.id);
  assert.doesNotMatch(page.headline+page.about,
   /current truck capacity|reliable freight capacity for growing ethiopian trade|verified|guaranteed|real-time/i,
   organization.id);
  const copy=`${page.headline} ${page.about}`.toLowerCase();
  const route=routes[0];
  const origin=route.origin.split(',')[0].toLowerCase();
  const destination=route.destination.split(',')[0].toLowerCase();
  assert.ok(copy.includes(origin),`${organization.id}: origin`);
  if(destination!==origin)assert.ok(copy.includes(destination),`${organization.id}: destination`);
  const types=vehicles.map(vehicle=>vehicle.category.toLowerCase());
  if(/\bvan[s]?\b/.test(copy))assert.ok(types.some(type=>type.includes('van')),organization.id);
  if(/\bpickup[s]?\b/.test(copy))assert.ok(types.some(type=>type.includes('pickup')),organization.id);
  if(/\bbox-body\b/.test(copy))assert.ok(types.some(type=>type.includes('box')),organization.id);
  if(/\bmini\b|\bcompact\b|\bsmall cargo\b/.test(copy)){
   assert.ok(types.some(type=>type.includes('mini')),organization.id);
  }
 }
});
