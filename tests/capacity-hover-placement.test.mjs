import assert from 'node:assert/strict';
import test from 'node:test';
import {capacityHoverPlacement} from '../src/lib/capacity-hover-placement.js';

const bounds={left:8,top:8,right:632,bottom:472};
const card={width:230,height:138};
const markerAt=(left,top)=>({left,top,right:left+64,bottom:top+75});

test('vehicle hover cards open above, below or beside the marker as the edges require',()=>{
  for(const [left,top,direction] of [
    [288,215,'top'],[288,20,'bottom'],[288,390,'top'],
    [16,215,'right'],[556,215,'left'],
  ]){
    const marker=markerAt(left,top);
    const placed=capacityHoverPlacement(marker,bounds,card);
    assert.equal(placed.direction,direction);
    assertContained(placed,bounds,card);
    if(direction==='top')assert.equal(placed.top+card.height,marker.top-8);
    if(direction==='bottom')assert.equal(placed.top,marker.bottom+8);
    if(direction==='left')assert.equal(placed.left+card.width,marker.left-8);
    if(direction==='right')assert.equal(placed.left,marker.right+8);
  }
});

test('a narrow or scrolled viewport clamps the card along its chosen side before overlapping the marker',()=>{
  const clipped={left:38,top:105,right:302,bottom:504};
  const marker=markerAt(42,120);
  const placed=capacityHoverPlacement(marker,clipped,card);
  assert.equal(placed.direction,'bottom');
  assert.equal(placed.top,marker.bottom+8);
  assert.equal(placed.left,clipped.left);
  assertContained(placed,clipped,card);
});

test('the largest visible portion remains within bounds when every side is crowded',()=>{
  const small={left:12,top:25,right:200,bottom:185};
  const measured={width:172,height:138};
  assertContained(capacityHoverPlacement(markerAt(76,70),small,measured),small,measured);
});

function assertContained(position,area,size){
  assert.ok(position.left>=area.left&&position.top>=area.top);
  assert.ok(position.left+size.width<=area.right&&position.top+size.height<=area.bottom);
}
