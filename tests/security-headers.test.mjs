import assert from 'node:assert/strict';
import test from 'node:test';
import {contentSecurityPolicy} from '../src/lib/security-headers.js';

test('CSP permits the managed OAuth form redirect chain through exact trusted origins',()=>{
  const production=contentSecurityPolicy({
    NODE_ENV:'production',
    NEXT_PUBLIC_SUPABASE_URL:'https://managed-auth.example.test/auth/v1'
  });
  assert.match(
    production,
    /form-action 'self' https:\/\/managed-auth\.example\.test https:\/\/accounts\.google\.com(?:;|$)/
  );
  assert.equal(production.includes('/auth/v1'),false);

  const local=contentSecurityPolicy({
    NODE_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55321/auth/v1'
  });
  assert.match(
    local,
    /form-action 'self' http:\/\/127\.0\.0\.1:55321 https:\/\/accounts\.google\.com(?:;|$)/
  );
});

test('CSP fails closed for invalid or insecure managed Auth origins',()=>{
  for(const environment of [
    {NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:''},
    {NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'not-a-url'},
    {NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'javascript:alert(1)'},
    {NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'ftp://managed-auth.example.test'},
    {NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55321'},
    {NODE_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:'http://managed-auth.example.test'},
    {NODE_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:'https://user:password@managed-auth.example.test'}
  ]){
    const policy=contentSecurityPolicy(environment);
    assert.match(policy,/form-action 'self'(?:;|$)/);
    assert.equal(policy.includes('managed-auth.example.test'),false);
    assert.equal(policy.includes('accounts.google.com'),false);
  }
});
