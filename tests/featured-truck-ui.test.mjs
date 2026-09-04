import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root=process.cwd();
const source=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('public featured cards lead with the exact truck and assigned Driver',()=>{
  const venue=source('src/components/transport-expo-venue.tsx');
  assert.match(venue,/vehicleConfigurationImage\(truck\.cargo_configuration\)/);
  assert.match(venue,/truck\.driver_first_name/);
  assert.match(venue,/truck\.driver_kind_label/);
  assert.match(venue,/truck\.name/);
  assert.match(venue,/truck\.truck_key/);
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
