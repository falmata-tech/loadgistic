import test from 'node:test';import assert from 'node:assert/strict';
import {contentBlocks,changeContentBlock} from '../src/lib/content-blocks.js';
test('blocked preferences accept only bounded public handles',()=>{assert.deepEqual(contentBlocks('["good-handle","good-handle","../private","","<script>"]'),['good-handle']);assert.deepEqual(contentBlocks('invalid'),[]);assert.equal(contentBlocks(Array.from({length:150},(_,i)=>'provider-'+i)).length,100);});
test('block and unblock preserve all other preferences',()=>{assert.deepEqual(changeContentBlock(['first'], 'second',true),['first','second']);assert.deepEqual(changeContentBlock(['first','second'],'first',false),['second']);assert.throws(()=>changeContentBlock([],'../private',true));});
