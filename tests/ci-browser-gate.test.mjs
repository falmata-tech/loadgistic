import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync('.github/workflows/ci.yml','utf8');
test('all four isolated browser shards remain required by the e2e release gate',()=>{
 assert.match(workflow,/fail-fast: false/);
 assert.match(workflow,/shard: \[1, 2, 3, 4\]/);
 assert.match(workflow,/npm run test:e2e -- --shard=\$\{\{ matrix.shard \}\}\/4/);
 const gate=workflow.slice(workflow.indexOf('  e2e:\n'),workflow.indexOf('  container:\n'));
 assert.match(gate,/needs: e2e-shards/);
 assert.match(gate,/if: always\(\)/);
 assert.match(gate,/test '\$\{\{ needs.e2e-shards.result \}\}' = 'success'/);
});
