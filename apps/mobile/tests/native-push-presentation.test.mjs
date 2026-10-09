import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePushPresentation} from '../src/session/native-push-presentation.ts';
test('an active screen uses its in-app feed without a duplicate system alert',()=>{
 assert.deepEqual(nativePushPresentation('active'),{shouldPlaySound:false,shouldSetBadge:false,shouldShowBanner:false,shouldShowList:false});
});
test('inactive, background and uninitialized lifecycle states retain generic OS alerts without invented badges',()=>{
 for(const state of ['background','inactive',null]){
  assert.deepEqual(nativePushPresentation(state),{shouldPlaySound:true,shouldSetBadge:false,shouldShowBanner:true,shouldShowList:true});
 }
});
