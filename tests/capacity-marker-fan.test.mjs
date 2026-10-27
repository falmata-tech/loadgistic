import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityMarkerFanLayout} from '../src/lib/capacity-marker-fan.js';

const box={width:320,height:420,top:68,bottom:24};
const marker={width:88,height:102,anchorY:1};
function bounds(anchor,offset){
 const x=anchor.x+offset[0],y=anchor.y+offset[1];
 return {left:x-marker.width/2,right:x+marker.width/2,top:y-marker.height,bottom:y};
}
test('two through four coincident vehicles fan into stable, individually reachable map positions',()=>{
 for(const count of [2,3,4]){
  const ids=Array.from({length:count},(_,i)=>`vehicle-${i}`),anchor={x:160,y:220};
  const layout=capacityMarkerFanLayout(ids,anchor,box,marker);
  assert.ok(layout);assert.deepEqual(layout.map(item=>item.id),ids);
  assert.deepEqual(capacityMarkerFanLayout([...ids].reverse(),anchor,box,marker),layout);
  for(const item of layout){const rect=bounds(anchor,item.offset);assert.ok(rect.left>=8&&rect.right<=312);assert.ok(rect.top>=76&&rect.bottom<=396);}
  for(let i=0;i<layout.length;i++)for(let j=i+1;j<layout.length;j++){
   const a=bounds(anchor,layout[i].offset),b=bounds(anchor,layout[j].offset);
   assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,'vehicle hit regions must not overlap');
  }
 }
});
test('small fan fits inward near the edge without changing input locations; large or impossible fans stay bounded',()=>{
 const anchor={x:14,y:80},ids=['v2','v1'],before=JSON.stringify({anchor,ids});
 const layout=capacityMarkerFanLayout(ids,anchor,box,marker);
 assert.ok(layout);for(const item of layout){const rect=bounds(anchor,item.offset);assert.ok(rect.left>=8&&rect.right<=312&&rect.top>=76&&rect.bottom<=396);}
 assert.equal(JSON.stringify({anchor,ids}),before);
 assert.equal(capacityMarkerFanLayout(['a','b','c','d','e'],anchor,box,marker),null);
 assert.equal(capacityMarkerFanLayout(ids,anchor,{...box,height:170},marker),null);
});
