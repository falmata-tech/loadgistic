import test from 'node:test';
import assert from 'node:assert/strict';
import {withFeaturedSaveStage,featuredSaveDiagnostic,featuredSaveDiagnosticLine} from '../src/lib/featured-save-diagnostic.js';
import {errorMessage} from '../src/lib/errors.ts';

test('Featured save attributes RPC and readback failures without changing the public error',async()=>{
 for(const stage of ['SAVE_RPC','READBACK']){
  const cause={code:'23514',message:'FEATURED_PROVIDER_INELIGIBLE vehicle:private-id user@example.test',details:'secret contact'};
  const failure=new Error('FEATURED_PROVIDER_INELIGIBLE',{cause});
  const publicError=errorMessage(failure);
  await assert.rejects(withFeaturedSaveStage(stage,async()=>{throw failure;}),caught=>{
   assert.equal(caught,failure);
   assert.deepEqual(featuredSaveDiagnostic(caught),{stage,category:'INTEGRITY',businessCode:'FEATURED_PROVIDER_INELIGIBLE'});
   assert.equal(errorMessage(caught),publicError);
   return true;
  });
 }
});

test('Featured save diagnostic excludes arbitrary messages, identifiers, contacts and credentials',async()=>{
 const secret='user@example.test vehicle:private-id bearer-private-token';
 const error=new Error(`UNLISTED_${secret}`,{cause:{code:'contact',message:`FEATURED_NOT_ALLOWLISTED ${secret}`,details:secret}});
 await assert.rejects(withFeaturedSaveStage('SAVE_RPC',async()=>{throw error;}),caught=>{
  const diagnostic=featuredSaveDiagnostic(caught);
  assert.deepEqual(diagnostic,{stage:'SAVE_RPC',category:'UNKNOWN',businessCode:null});
  const serialized=featuredSaveDiagnosticLine(caught);
  assert.match(serialized,/^FEATURED_ADMIN_SAVE \{"stage":"SAVE_RPC","category":"UNKNOWN","businessCode":null\}$/);
  for(const forbidden of ['@','vehicle:','bearer','private-id','UNLISTED','FEATURED_NOT_ALLOWLISTED'])assert.equal(serialized.includes(forbidden),false);
  return true;
 });
 assert.equal(featuredSaveDiagnostic(new Error(secret)),null);
 assert.equal(featuredSaveDiagnosticLine(new Error(secret)),null);
 await assert.rejects(withFeaturedSaveStage('OTHER',async()=>{}),/FEATURED_SAVE_STAGE_INVALID/);
});

test('Featured save diagnostic bounds common database failures to fixed categories',async()=>{
 for(const [sqlstate,category] of [['42501','PERMISSION'],['57014','TIMEOUT'],['40P01','CONCURRENCY'],['42883','SCHEMA'],['P0001','BUSINESS_RULE']]){
  const failure=new Error('raw private message',{cause:{code:sqlstate,message:'raw private details'}});
  await assert.rejects(withFeaturedSaveStage('READBACK',async()=>{throw failure;}),caught=>{
   assert.deepEqual(featuredSaveDiagnostic(caught),{stage:'READBACK',category,businessCode:null});
   return true;
  });
 }
});
