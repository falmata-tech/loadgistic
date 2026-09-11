import assert from 'node:assert/strict';
import test from 'node:test';
import {projectSupabasePlaces} from '../src/lib/repository/supabase.js';

function place(overrides={}){
  return {
    id:'place-id',name:'Place',normalized_name:'place',alternate_names:null,
    place_type:'town',latitude:9,longitude:38,population:100,wikidata_id:null,
    source:'fixture',parent_name:null,country_name:'Ethiopia',country_code:'ET',
    ...overrides
  };
}

test('Supabase place projection keeps exact and type matches ahead of population',()=>{
  const results=projectSupabasePlaces([
    place({id:'large',name:'Addis Alem',normalized_name:'addis alem',place_type:'city',population:9_000_000}),
    place({id:'exact-town',name:'Addis',normalized_name:'addis',place_type:'town',population:10}),
    place({id:'exact-city',name:'Addis',normalized_name:'addis',place_type:'city',population:5})
  ],'addis',3);
  assert.deepEqual(results.map(result=>result.id),['exact-city','exact-town','large']);
});

test('Supabase place projection is bounded and emits only the public place contract',()=>{
  const results=projectSupabasePlaces([
    place({id:'one',name:'Addis Ababa',normalized_name:'addis ababa',parent_name:'Addis Ababa'}),
    place({id:'two',name:'Addis Ketema',normalized_name:'addis ketema',parent_name:'Addis Ababa'})
  ],'addis',1);
  assert.equal(results.length,1);
  assert.deepEqual(results[0],{
    id:'one',name:'Addis Ababa',display_name:'Addis Ababa, Ethiopia',country_name:'Ethiopia',
    country_code:'ET',parent_name:'Addis Ababa',place_type:'town',lat:9,lng:38,
    population:100,wikidata_id:null,source:'fixture'
  });
  assert.equal(Object.hasOwn(results[0],'alternate_names'),false);
  assert.equal(Object.hasOwn(results[0],'normalized_name'),false);
});
