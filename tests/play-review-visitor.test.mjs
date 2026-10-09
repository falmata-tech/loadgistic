import test from 'node:test';import assert from 'node:assert/strict';
import {parseReviewVisitor} from '../src/lib/privacy/review-visitor.js';
const now=2000000,id='00000000-0000-4000-8000-000000000001';
test('review visitor is scope-bound and cannot masquerade as ordinary email access',()=>{
 const payload={sub:`mobile-review-visitor:tracking:${id}:${now}`,exp:(now+300000)/1000};
 assert.equal(parseReviewVisitor(payload,'tracking',now).reviewActorId,id);
 assert.equal(parseReviewVisitor(payload,'capacity',now),null);
 assert.equal(parseReviewVisitor({...payload,sub:payload.sub.replace('review-','')},'tracking',now),null);
});
test('review access expires on the same five-minute tracking limit',()=>{
 const sub=`mobile-review-visitor:tracking:${id}:${now}`;
 assert.equal(parseReviewVisitor({sub,exp:(now+301000)/1000},'tracking',now),null);
 assert.equal(parseReviewVisitor({sub,exp:(now+300000)/1000},'tracking',now+300000),null);
});
