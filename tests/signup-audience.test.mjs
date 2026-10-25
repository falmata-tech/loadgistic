import assert from 'node:assert/strict';
import test from 'node:test';
import {signupAudience,signupEntry} from '../src/lib/signup-audience.js';

test('signup choice is only a bounded handoff hint, not a role or arbitrary return URL',()=>{
  assert.equal(signupAudience('PROVIDER'),'PROVIDER');
  assert.equal(signupAudience('BUSINESS'),'BUSINESS');
  for(const value of ['ADMIN','SUPPORT','DRIVER','https://outside.example',''])assert.equal(signupAudience(value),'EXISTING');
  assert.equal(signupEntry('shared-capacity'),'shared-capacity');
  for(const value of ['https://outside.example','/admin',''])assert.equal(signupEntry(value),'');
});
