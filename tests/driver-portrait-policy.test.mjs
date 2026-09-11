import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {assignFixtureDriverPortraits} from '../scripts/fixture-driver-portraits.mjs';
import {
  EXISTING_DRIVER_PORTRAIT_PRESETS,
  NEW_DRIVER_PORTRAIT_PRESETS,
  driverPortraitUrl
} from '../src/lib/driver-portraits.js';

const root=process.cwd();

test('the managed fixture uses a unique 21 existing, 24 new, and 98 icon Driver mix',()=>{
  const tables=JSON.parse(fs.readFileSync(path.join(root,'resources/fixtures/managed-market.json'),'utf8')).tables;
  const projected=assignFixtureDriverPortraits(tables.users);
  const drivers=projected.filter(user=>user.role==='DRIVER');
  const photographed=drivers.filter(user=>user.driver_portrait_preset);
  const missing=drivers.filter(user=>!user.driver_portrait_preset);
  const existingSet=new Set(EXISTING_DRIVER_PORTRAIT_PRESETS);
  const newSet=new Set(NEW_DRIVER_PORTRAIT_PRESETS);

  assert.equal(drivers.length,143);
  assert.equal(photographed.filter(user=>existingSet.has(user.driver_portrait_preset)).length,21);
  assert.equal(photographed.filter(user=>newSet.has(user.driver_portrait_preset)).length,24);
  assert.equal(missing.length,98);
  assert.equal(new Set(photographed.map(user=>user.driver_portrait_preset)).size,45);
  assert.ok(drivers.slice(-20).some(user=>user.driver_portrait_preset));
  assert.equal(projected.filter(user=>user.role!=='DRIVER').every(user=>!user.driver_portrait_preset),true);

  for(const driver of photographed){
    const url=driverPortraitUrl(driver.driver_portrait_preset);
    assert.match(url,/^\/marketing\/drivers\/[a-z0-9-]+\.jpg$/);
    assert.equal(fs.existsSync(path.join(root,'public',url)),true,`Missing Driver portrait asset: ${url}`);
  }
});

test('the Driver portrait resolver rejects unlisted files and paths',()=>{
  assert.equal(driverPortraitUrl('../private.png'),null);
  assert.equal(driverPortraitUrl('not-in-the-reviewed-pool.png'),null);
  assert.equal(driverPortraitUrl(''),null);
});
