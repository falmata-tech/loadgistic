import test from 'node:test';
import assert from 'node:assert/strict';
import {trackingProgress} from '../src/lib/tracking-progress.js';

test('saved progression distinguishes current, completed, next, and remaining',()=>{
  const state=s=>trackingProgress(s,'LOADING',['CREATED','TO_PICKUP','LOADING'],['IN_TRANSIT','ISSUE']);
  assert.equal(state('TO_PICKUP'),'Completed');assert.equal(state('LOADING'),'Current');
  assert.equal(state('IN_TRANSIT'),'Next');assert.equal(state('UNLOADING'),'Remaining');
});
test('initial shortcut and skipped history never invent completion',()=>{
  assert.equal(trackingProgress('LOADING','CREATED',['CREATED'],['TO_PICKUP','LOADING','ISSUE']),'Or start here');
  assert.equal(trackingProgress('TO_PICKUP','LOADING',['CREATED','LOADING'],['IN_TRANSIT','ISSUE']),'Not recorded');
  assert.equal(trackingProgress('LOADING','COMPLETED',['CREATED','COMPLETED'],[]),'Not recorded');
});
test('problem recovery and cancellation do not imply a completed journey',()=>{
  assert.equal(trackingProgress('LOADING','ISSUE',['CREATED','LOADING','ISSUE'],['TO_PICKUP','LOADING','IN_TRANSIT','UNLOADING']),'Resume · previously recorded');
  assert.equal(trackingProgress('UNLOADING','ISSUE',['CREATED','ISSUE'],['UNLOADING']),'Resume here');
  assert.equal(trackingProgress('LOADING','CANCELLED',['CREATED','LOADING'],[]),'Previously recorded');
  assert.equal(trackingProgress('COMPLETED','CANCELLED',['CREATED','LOADING'],[]),'Not reached');
});
