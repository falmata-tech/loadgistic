import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root=process.cwd();
const source=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('public featured cards lead with the assigned Driver portrait and retain the exact truck',()=>{
  const venue=source('src/components/transport-expo-venue.tsx');
  assert.match(venue,/DriverPortrait/);
  assert.match(venue,/truck\.driver_portrait_url/);
  assert.match(venue,/truck\.driver_first_name/);
  assert.match(venue,/truck\.driver_kind_label/);
  assert.match(venue,/truck\.cargo_configuration/);
  assert.match(venue,/truck\.name/);
  assert.match(venue,/truck\.truck_key/);
  assert.match(venue,/driver-portrait-fallback/);
  assert.match(venue,/driver-steering-wheel/);
  assert.doesNotMatch(venue,/Disc3/);
  assert.match(venue,/entry\.type==='PROGRAMME_BREAK'/);
  assert.doesNotMatch(venue,/SPONSOR_BREAK|INTERMISSION/);
});
test('featured route loading preserves the final page geometry without editorial copy',()=>{
  const loading=source('src/app/featured/loading.tsx');
  for(const className of ['regional-expo-shell','featured-skeleton-intro','featured-skeleton-command','featured-skeleton-board']){
    assert.match(loading,new RegExp(className));
  }
  assert.match(loading,/aria-busy="true"/);
  assert.doesNotMatch(loading,/Preparing|Loading the regional|portraits/);
});
test('empty featured roster keeps readable full-width copy and one market action',()=>{
  const section=source('src/components/featured-provider-section.tsx');
  const styles=source('src/app/globals.css');
  assert.match(section,/regional-expo-empty/);
  assert.match(section,/Today&apos;s truck roster is being prepared\./);
  assert.match(section,/href="\/">Find capacity/);
  assert.match(styles,/\.regional-expo-empty\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(styles,/@media\(max-width:760px\)\{\.regional-expo-empty\{grid-template-columns:minmax\(0,1fr\)/);
});
