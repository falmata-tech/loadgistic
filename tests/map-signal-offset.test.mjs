import test from 'node:test';
import assert from 'node:assert/strict';
import {offsetSignalPath} from '../src/lib/map-signal-offset.js';

const square=[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}];
test('coincident area lanes separate every edge and are independent of winding/start vertex',()=>{
  const snapshot=JSON.stringify(square);
  const outer=offsetSignalPath(square,12,true),inner=offsetSignalPath(square,-12,true);
  assert.deepEqual(outer,[{x:-12,y:-12},{x:212,y:-12},{x:212,y:212},{x:-12,y:212}]);
  assert.deepEqual(inner,[{x:12,y:12},{x:188,y:12},{x:188,y:188},{x:12,y:188}]);
  assert.deepEqual(offsetSignalPath([...square].reverse(),12,true).reverse(),outer);
  const rotated=[...square.slice(2),...square.slice(0,2)];
  assert.deepEqual(offsetSignalPath(rotated,12,true),[...outer.slice(2),...outer.slice(0,2)]);
  assert.equal(JSON.stringify(square),snapshot);
});
test('a closed route joins once with no start/end gap and reversed open routes retain opposite lanes',()=>{
  const loop=offsetSignalPath([...square,square[0]],12);
  assert.deepEqual(loop[0],loop.at(-1));assert.equal(loop.length,5);
  const open=[{x:0,y:0},{x:200,y:0}];
  const current=offsetSignalPath(open,-6),regular=offsetSignalPath([...open].reverse(),6).reverse();
  assert.deepEqual(current,[{x:0,y:-6},{x:200,y:-6}]);
  assert.deepEqual(regular,[{x:0,y:6},{x:200,y:6}]);
});
test('sharp and degenerate outlines stay finite with bounded displacement',()=>{
  for(const points of [[{x:0,y:0}],Array(3).fill({x:3,y:4}),[{x:0,y:0},{x:200,y:0},{x:1,y:1}],square]){
    const shifted=offsetSignalPath(points,12,true);
    assert.ok(shifted.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
    assert.ok(shifted.every(p=>points.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<=24.00001)));
  }
});
test('the inward lane shrinks for a tiny area instead of inverting its boundary',()=>{
  const tiny=square.map(p=>({x:p.x/50,y:p.y/50}));
  const inset=offsetSignalPath(tiny,-12,true);
  assert.ok(inset.every(p=>p.x>0&&p.x<4&&p.y>0&&p.y<4));
  assert.ok(inset[0].x<inset[1].x&&inset[1].y<inset[2].y);
});

function segmentDistance(point,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
}
function distanceToPath(point,path){return Math.min(...path.slice(1).map((p,i)=>segmentDistance(point,path[i],p)));}
test('a regular route continuing beyond the current leg cannot choose the same shared lane',()=>{
  const a={x:200,y:300},b={x:100,y:0},c={x:-100,y:200},d={x:300,y:600};
  const current=offsetSignalPath([a,b],-6);
  for(const points of [[a,b,c,d],[d,c,b,a]]){
    const regular=offsetSignalPath(points,6,false,[current]);
    for(const t of [.2,.4,.6,.8]){
      const p={x:current[0].x+(current[1].x-current[0].x)*t,y:current[0].y+(current[1].y-current[0].y)*t};
      assert.ok(distanceToPath(p,regular)>=11.9,'shared leg must have its own lane');
    }
  }
});

test('partial collinear overlap and added intermediate cities keep a clear lane',()=>{
  const current=offsetSignalPath([{x:0,y:0},{x:200,y:0}],-6);
  for(const route of [
    [{x:-100,y:-12},{x:60,y:-12},{x:300,y:-12},{x:400,y:100}],
    [{x:400,y:100},{x:300,y:-12},{x:60,y:-12},{x:-100,y:-12}],
  ]){
    const regular=offsetSignalPath(route,6,false,[current]);
    for(const x of [30,90,150])assert.ok(distanceToPath({x,y:-6},regular)>=11.9);
  }
});
test('a route sharing a polygon edge stays clear in either winding and route direction',()=>{
  for(const boundary of [square,[...square].reverse()]){
    const area=offsetSignalPath(boundary,-12,true);area.push(area[0]);
    for(const points of [[square[0],square[1]],[square[1],square[0]]]){
      const regular=offsetSignalPath(points,6,false,[area]);
      for(const x of [50,100,150])assert.ok(distanceToPath({x,y:12},regular)>=11.9);
    }
  }
  const current=offsetSignalPath([square[0],square[1]],-6);
  const regularArea=offsetSignalPath(square,12,true,[current]);regularArea.push(regularArea[0]);
  assert.ok(distanceToPath({x:100,y:-6},regularArea)>=11.9);
});
test('near-parallel strokes separate but a single transverse crossing does not move the lane',()=>{
  const current=offsetSignalPath([{x:0,y:0},{x:300,y:0}],-6);
  const close=[{x:0,y:-13},{x:300,y:-10}];
  const regular=offsetSignalPath(close,6,false,[current]);
  for(const x of [50,150,250])assert.ok(distanceToPath({x,y:-6},regular)>=11.9);
  const crossPath=[{x:150,y:-100},{x:150,y:100}];
  assert.deepEqual(offsetSignalPath(crossPath,6,false,[current]),offsetSignalPath(crossPath,6));
});
test('sharp turns bevel rather than bending a long shared leg onto the other stroke',()=>{
  const current=offsetSignalPath([{x:0,y:0},{x:300,y:0}],-6);
  const route=[{x:0,y:0},{x:300,y:0},{x:5,y:2}];
  const regular=offsetSignalPath(route,6,false,[current]);
  for(const x of [50,150,250])assert.ok(distanceToPath({x,y:-6},regular)>=11.9);
  assert.ok(regular.every(p=>route.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<=48.00001)));
  const unopposed=offsetSignalPath(route,6);
  assert.ok(unopposed.every(p=>route.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<=12.00001)));
});
test('shared route edges keep clearance across screen orientations and path reversal',()=>{
  for(let degrees=0;degrees<360;degrees+=15){
    const a=degrees*Math.PI/180,rotate=({x,y})=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)});
    const [start,end,extra]=[{x:0,y:0},{x:300,y:0},{x:-50,y:300}].map(rotate);
    for(const currentInput of [[start,end],[end,start]])for(const regularInput of [[start,end,extra],[extra,end,start]]){
      const current=offsetSignalPath(currentInput,-6),regular=offsetSignalPath(regularInput,6,false,[current]);
      const p={x:(current[0].x+current[1].x)/2,y:(current[0].y+current[1].y)/2};
      assert.ok(distanceToPath(p,regular)>=11.9,`orientation ${degrees}`);
    }
  }
});
