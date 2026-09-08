import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const queryRoutes=[
  'src/app/api/public/capacity/route.ts',
  'src/app/api/places/route.ts'
];

for(const route of queryRoutes){
  test(`${route} keeps query-sensitive responses outside shared caches`,()=>{
    const source=readFileSync(route,'utf8');
    assert.match(source,/'Cache-Control':'private, no-store, max-age=0'/);
    assert.match(source,/'CDN-Cache-Control':'no-store'/);
    assert.match(source,/'Netlify-CDN-Cache-Control':'no-store'/);
    assert.doesNotMatch(source,/'Cache-Control':'public/);
  });
}
