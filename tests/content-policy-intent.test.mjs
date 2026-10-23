import test from 'node:test';
import assert from 'node:assert/strict';
import {contentConsentForActor} from '../src/lib/privacy/content-policy-intent.js';
test('a previous account checkbox cannot authorize a newly signed-in account',()=>{
 assert.equal(contentConsentForActor({actorId:'first',checked:true},'second'),false);
 assert.equal(contentConsentForActor({actorId:'first',checked:true},undefined),false);
 assert.equal(contentConsentForActor({actorId:'',checked:true},''),false);
});
test('only an explicit check for the current account authorizes its terms submission',()=>{
 assert.equal(contentConsentForActor({actorId:'first',checked:false},'first'),false);
 assert.equal(contentConsentForActor(null,'first'),false);
 assert.equal(contentConsentForActor({actorId:'first',checked:true},'first'),true);
});
