import test from 'node:test';
import assert from 'node:assert/strict';
import {supportRevisionTag,supportRevisionMatches} from '../src/lib/support-polling.js';
test('conditional Support tags distinguish current state, presence, history and read intent',()=>{
 const first=supportRevisionTag(['one',{available:true},null,false]);
 assert.equal(first,supportRevisionTag(['one',{available:true},null,false]));
 assert.match(first,/^"[a-f0-9]{64}"$/);
 for(const state of [['two',{available:true},null,false],['one',{available:false},null,false],['one',{available:true},'older',false],['one',{available:true},null,true]])assert.notEqual(first,supportRevisionTag(state));
 assert.equal(supportRevisionMatches(`${supportRevisionTag('other')}, ${first}`,first),true);
 for(const header of [null,undefined,'*',first.slice(1,-1),`W/${first}`])assert.equal(supportRevisionMatches(header,first),false);
});
