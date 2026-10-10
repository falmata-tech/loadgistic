import test from 'node:test';
import assert from 'node:assert/strict';
import {backgroundNoticeVisible,navigationHeaderEdges} from '../src/location/background-notice.ts';

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

test('the navigation consumes the top inset only when a notice has not already consumed it',()=>{
 assert.deepEqual(navigationHeaderEdges(false),['top','left','right']);
 assert.deepEqual(navigationHeaderEdges(true),['left','right']);
 // Guests and another actor recover normal header protection immediately.
 assert.ok(navigationHeaderEdges(backgroundNoticeVisible('android','','driver-one',true,'')).includes('top'));
 assert.ok(navigationHeaderEdges(backgroundNoticeVisible('android','driver-two','driver-one',true,'')).includes('top'));
});
