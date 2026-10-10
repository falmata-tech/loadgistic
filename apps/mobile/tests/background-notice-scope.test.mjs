import test from 'node:test';
import assert from 'node:assert/strict';
import {backgroundNoticeVisible} from '../src/location/background-notice.ts';

test('sign-out and account changes hide the prior driver notice immediately',()=>{
 assert.equal(backgroundNoticeVisible('android','','driver-one',true,''),false);
 assert.equal(backgroundNoticeVisible('android','driver-two','driver-one',true,''),false);
 assert.equal(backgroundNoticeVisible('ios','driver-two','driver-one',false,'Check Tracking'),false);
 assert.equal(backgroundNoticeVisible('android','driver-two','',true,''),false);
});

test('only a current native actor with a pending action or error sees the notice',()=>{
 assert.equal(backgroundNoticeVisible('android','driver-one','driver-one',true,''),true);
 assert.equal(backgroundNoticeVisible('ios','driver-one','driver-one',false,'Check Tracking'),true);
 assert.equal(backgroundNoticeVisible('android','driver-one','driver-one',false,''),false);
 assert.equal(backgroundNoticeVisible('web','driver-one','driver-one',true,''),false);
});
