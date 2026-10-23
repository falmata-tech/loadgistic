import test from 'node:test';
import assert from 'node:assert/strict';
import {portraitUpload,portraitRemove} from '../src/lib/mobile/portrait-contract.js';
test('native portrait requires explicit consent and forbids selecting another actor',()=>{
 assert.equal(portraitUpload.safeParse({action:'UPLOAD',consent:true}).success,true);
 for(const input of [{action:'UPLOAD'},{action:'UPLOAD',consent:false},{action:'UPLOAD',consent:'true'},{action:'UPLOAD',consent:true,actorId:'other'}])assert.equal(portraitUpload.safeParse(input).success,false);
 assert.equal(portraitRemove.safeParse({action:'REMOVE',confirm:true}).success,true);assert.equal(portraitRemove.safeParse({action:'REMOVE'}).success,false);
});
