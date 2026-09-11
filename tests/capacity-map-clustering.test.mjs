import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCapacityMarkerGroups,
  capacityClusterCellSize,
  MAX_CLUSTER_MEMBERS,
  MAX_VISUAL_OFFSET_PX
} from '../src/lib/capacity-map-clustering.js';

function marker(id,status,x,y,lat=9+y/10_000,lng=38+x/10_000){
  return{id,status,x,y,lat,lng};
}

test('capacity clusters are status-separated, bounded, and geographically anchored',()=>{
  const entries=[
    ...Array.from({length:18},(_,index)=>marker(`empty-${String(index).padStart(2,'0')}`,'EMPTY',100+index/10,200+index/10,9+index/100,38+index/100)),
    ...Array.from({length:9},(_,index)=>marker(`partial-${String(index).padStart(2,'0')}`,'PARTIAL',101+index/10,201+index/10,10+index/100,39+index/100))
  ];
  const groups=buildCapacityMarkerGroups(entries,8);

  assert.equal(groups.length,5);
  assert.ok(groups.every(group=>group.memberIds.length<=MAX_CLUSTER_MEMBERS));
  assert.ok(groups.every(group=>group.memberIds.every(id=>id.startsWith(group.status==='EMPTY'?'empty-':'partial-'))));
  assert.ok(groups.every(group=>Math.hypot(group.visualOffset.x,group.visualOffset.y)<=MAX_VISUAL_OFFSET_PX));

  const firstEmpty=groups.find(group=>group.memberIds.includes('empty-00'));
  assert.ok(firstEmpty);
  assert.equal(firstEmpty.anchor.lat,9.035);
  assert.equal(firstEmpty.anchor.lng,38.035);
});

test('fixed global cells do not form transitive regional clusters',()=>{
  const cellSize=capacityClusterCellSize(6);
  const groups=buildCapacityMarkerGroups([
    marker('west','EMPTY',0,20),
    marker('middle','EMPTY',cellSize-1,20),
    marker('east','EMPTY',cellSize*2-2,20)
  ],6);

  assert.deepEqual(groups.map(group=>group.memberIds),[['west','middle'],['east']]);
  const expectedLongitudes=[38+(cellSize-1)/20_000,38+(cellSize*2-2)/10_000];
  groups.forEach((group,index)=>assert.ok(Math.abs(group.anchor.lng-expectedLongitudes[index])<1e-10));
});

test('city zoom cells remain at least as wide as an unselected truck marker',()=>{
  assert.ok(capacityClusterCellSize(6)>=64);
  assert.ok(capacityClusterCellSize(8)>=72);
  assert.ok(capacityClusterCellSize(15)>=88);

  const dense=buildCapacityMarkerGroups([
    marker('one','PARTIAL',440,440),
    marker('two','PARTIAL',462,452),
    marker('three','PARTIAL',478,466)
  ],15);
  assert.equal(dense.length,1);
  assert.deepEqual(dense[0].memberIds,['one','two','three']);
});

test('opposite statuses remain separated across a screen-cell boundary',()=>{
  const groups=buildCapacityMarkerGroups([
    marker('empty','EMPTY',87,400),
    marker('partial','PARTIAL',89,400)
  ],15);
  assert.equal(groups.length,2);
  const centers=groups.map(group=>({
    status:group.status,
    x:group.projectedAnchor.x+group.visualOffset.x,
    y:group.projectedAnchor.y+group.visualOffset.y
  }));
  assert.ok(Math.hypot(centers[0].x-centers[1].x,centers[0].y-centers[1].y)>=58);
  assert.ok(groups.every(group=>Math.hypot(group.visualOffset.x,group.visualOffset.y)<=MAX_VISUAL_OFFSET_PX));
});

test('overflow groups at one anchor receive distinct stable positions',()=>{
  const entries=Array.from({length:12},(_,index)=>marker(`partial-${String(index).padStart(2,'0')}`,'PARTIAL',700,700));
  const groups=buildCapacityMarkerGroups(entries,15);
  assert.equal(groups.length,2);
  const centers=groups.map(group=>({x:group.projectedAnchor.x+group.visualOffset.x,y:group.projectedAnchor.y+group.visualOffset.y}));
  assert.ok(Math.hypot(centers[0].x-centers[1].x,centers[0].y-centers[1].y)>=58);
  assert.deepEqual(buildCapacityMarkerGroups([...entries].reverse(),15),groups);
});

test('cluster output is deterministic across input order and repeated zoom state',()=>{
  const entries=[
    marker('b','PARTIAL',220,180),
    marker('a','PARTIAL',219,181),
    marker('d','EMPTY',220,180),
    marker('c','EMPTY',219,181)
  ];
  const forward=buildCapacityMarkerGroups(entries,9);
  const reversed=buildCapacityMarkerGroups([...entries].reverse(),9);

  assert.deepEqual(forward,reversed);
  assert.deepEqual(buildCapacityMarkerGroups(entries,9),forward);
  const empty=forward.find(group=>group.status==='EMPTY');
  const partial=forward.find(group=>group.status==='PARTIAL');
  assert.ok(empty&&partial);
  assert.ok(empty.visualOffset.x<partial.visualOffset.x);
  assert.ok(partial.visualOffset.x-empty.visualOffset.x>=48);
  assert.deepEqual(empty.anchor,partial.anchor);
});

test('thousands of markers retain bounded groups without pairwise placement',()=>{
  const entries=Array.from({length:12_000},(_,index)=>marker(
    `truck-${index}`,
    index%3?'EMPTY':'PARTIAL',
    (index%400)*13,
    Math.floor(index/400)*13
  ));
  const groups=buildCapacityMarkerGroups(entries,7);
  const memberCount=groups.reduce((sum,group)=>sum+group.memberIds.length,0);

  assert.equal(memberCount,entries.length);
  assert.ok(groups.every(group=>group.memberIds.length<=MAX_CLUSTER_MEMBERS));
  assert.ok(groups.every(group=>Math.abs(group.visualOffset.x)<=MAX_VISUAL_OFFSET_PX&&Math.abs(group.visualOffset.y)<=MAX_VISUAL_OFFSET_PX));
});
