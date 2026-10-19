import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {actualSeedStatement,bootstrapProbeSql,selectedDatabase,localDatabaseUser} from '../scripts/verify-featured-bootstrap-local.mjs';

test('bootstrap runner has only its pinned local default and exact disposable database override',()=>{
  assert.equal(selectedDatabase([]),'postgres');
  assert.equal(selectedDatabase(['--database','loadgistic_featured137_20261013']),'loadgistic_featured137_20261013');
  assert.equal(localDatabaseUser(selectedDatabase([])),'postgres');
  assert.equal(localDatabaseUser(selectedDatabase(['--database','loadgistic_featured137_20261013'])),'supabase_admin');
  assert.throws(()=>localDatabaseUser('production'),/FEATURED_BOOTSTRAP_LOCAL_TARGET_REQUIRED/);
  for(const args of [['--database','production'],['--database','postgres'],['--url','postgres://remote'],['--container','other'],['--database','loadgistic_featured137_20261013','extra']]){
    assert.throws(()=>selectedDatabase(args),/FEATURED_BOOTSTRAP_LOCAL_TARGET_REQUIRED/);
  }
});
test('bootstrap runner extracts exactly the approved actual seed and rejects artifact drift',()=>{
  const source=readFileSync(new URL('../supabase/migrations/137_featured_continuous_rotation.sql',import.meta.url));
  const seed=actualSeedStatement(source);
  assert.ok(String(source).includes(seed));assert.match(seed,/origin\n/);assert.match(seed,/history\.round_number=/);assert.match(seed,/day\.feature_date>=/);
  assert.throws(()=>actualSeedStatement(Buffer.concat([source,Buffer.from('\n')])),/FEATURED_MIGRATION_DIGEST_CHANGED/);
});
test('bootstrap probe requires a single actual-source insertion marker and rollback boundary',()=>{
  const fixture=readFileSync(new URL('./sql/featured-rotation-bootstrap.sql',import.meta.url),'utf8');
  const seed=actualSeedStatement(readFileSync(new URL('../supabase/migrations/137_featured_continuous_rotation.sql',import.meta.url)));
  const input=bootstrapProbeSql(fixture,seed);
  assert.ok(input.includes(seed));assert.match(input,/^rollback;\s*$/m);
  assert.throws(()=>bootstrapProbeSql(fixture.replace('rollback;','commit;'),seed),/FEATURED_BOOTSTRAP_ROLLBACK_TEMPLATE_REQUIRED/);
  assert.throws(()=>bootstrapProbeSql(fixture+'\nbegin;\ncommit;',seed),/FEATURED_BOOTSTRAP_ROLLBACK_TEMPLATE_REQUIRED/);
  assert.throws(()=>bootstrapProbeSql(fixture+'\n-- ACTUAL_MIGRATION_137_SEED_BLOCK',seed),/FEATURED_BOOTSTRAP_ROLLBACK_TEMPLATE_REQUIRED/);
});
