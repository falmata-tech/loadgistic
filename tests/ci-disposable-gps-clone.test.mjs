import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  checkedLocalGpsPassword, checkedLocalRestoreRole, checkedMatchingPgMajor,
  postgresErrorCategory, runGpsClonePipeline, splitPgGraphqlAclToc,
  captureGpsCloneGraphql,checkedGpsCloneArchive,restoreGpsCloneArchive,
  proveGpsCloneGraphqlCreation,gpsCloneGraphqlArchiveDiagnostic,
} from '../scripts/ci-disposable-gps-clone.mjs';

const child = (source) => [process.execPath, ['-e', source]];

function run(dumpSource, restoreSource, options = {}) {
  const [dumpCommand, dumpArgs] = child(dumpSource);
  const [restoreCommand, restoreArgs] = child(restoreSource);
  return runGpsClonePipeline({
    dumpCommand, dumpArgs, restoreCommand, restoreArgs,
    env: process.env, timeoutMs: 10_000, killAfterMs: 500, ...options,
  });
}

test('GPS CI clone accepts a complete streamed dump and restore', async () => {
  await run(
    'process.stdout.write("fixture");',
    'let text="";process.stdin.on("data",chunk=>text+=chunk);process.stdin.on("end",()=>process.exit(text==="fixture"?0:1));',
  );
});

test('GPS CI clone stops dump promptly when restore fails and never prints raw stderr', async () => {
  const started = Date.now();
  await assert.rejects(
    run(
      'setInterval(()=>process.stdout.write("fixture"),10);',
      'process.stderr.write("pg_restore: error: role private-credential does not exist\\n");process.exit(1);',
    ),
    (error) => {
      assert.match(error.message, /GPS clone restore/);
      assert.match(error.message, /restore=1/);
      assert.match(error.message, /restore=role-missing/);
      assert.doesNotMatch(error.message, /private-credential/);
      return true;
    },
  );
  assert.ok(Date.now() - started < 5000, 'peer failure must not wait for the full clone timeout');
});

test('GPS CI clone stops restore promptly when dump fails', async () => {
  await assert.rejects(
    run(
      'process.stderr.write("pg_dump: error: server version mismatch\\n");process.exit(1);',
      'process.stdin.resume();setInterval(()=>{},1000);',
    ),
    (error) => {
      assert.match(error.message, /GPS clone dump/);
      assert.match(error.message, /dump=1/);
      assert.match(error.message, /dump=version-mismatch/);
      return true;
    },
  );
});

test('GPS CI clone timeout reports bounded stage and child outcomes', async () => {
  await assert.rejects(
    run('setInterval(()=>{},1000);', 'process.stdin.resume();setInterval(()=>{},1000);', {
      timeoutMs: 250, killAfterMs: 200,
    }),
    (error) => {
      assert.match(error.message, /GPS clone timeout/);
      assert.match(error.message, /exits dump=SIGTERM,restore=SIGTERM/);
      return true;
    },
  );
});

test('GPS CI clone reports a missing client without waiting for its peer', async () => {
  const [restoreCommand, restoreArgs] = child('process.stdin.resume();setInterval(()=>{},1000);');
  await assert.rejects(
    runGpsClonePipeline({
      dumpCommand: '/missing-loadgistic-pg-dump', dumpArgs: [],
      restoreCommand, restoreArgs, env: process.env,
      timeoutMs: 5000, killAfterMs: 200,
    }),
    (error) => {
      assert.match(error.message, /GPS clone dump/);
      assert.match(error.message, /dump=spawn-ENOENT/);
      return true;
    },
  );
});

test('PostgreSQL category classifier emits a fixed label for unknown sensitive output', () => {
  assert.equal(postgresErrorCategory('secret=reviewer-password'), 'unclassified');
  assert.equal(postgresErrorCategory('pg_restore: error: could not execute query: ERROR: duplicate'), 'restore-sql-error');
  assert.equal(postgresErrorCategory('ERROR: permission denied to set parameter "deadlock_timeout"'), 'permission-denied');
});

test('GPS CI target accepts only the exact local Supabase database, without leaking its password', () => {
  const secret = 'local-only-secret';
  const valid = {DB_URL: `postgresql://postgres:${secret}@127.0.0.1:55322/postgres`};
  assert.equal(checkedLocalGpsPassword(valid), secret);
  for (const value of [
    `postgresql://postgres:${secret}@localhost:55322/postgres`,
    `postgresql://postgres:${secret}@127.0.0.1:5432/postgres`,
    `postgresql://postgres:${secret}@127.0.0.1:55322/other`,
    `postgresql://supabase_admin:${secret}@127.0.0.1:55322/postgres`,
    `postgresql://postgres:${secret}@127.0.0.1:55322/postgres?sslmode=require`,
    'postgresql://postgres@127.0.0.1:55322/postgres',
  ]) {
    assert.throws(() => checkedLocalGpsPassword({DB_URL: value}), (error) => {
      assert.match(error.message, /GPS CI local database target mismatch/);
      assert.doesNotMatch(error.message, /local-only-secret/);
      return true;
    });
  }
});

test('GPS CI restore rejects a wrong authenticated role', () => {
  assert.equal(checkedLocalRestoreRole('supabase_admin'), 'supabase_admin');
  for (const role of ['postgres', 'anon', '']) {
    assert.throws(() => checkedLocalRestoreRole(role), /GPS CI local restore role mismatch/);
  }
});

test('GPS CI client matches only a reviewed local server major', () => {
  assert.equal(checkedMatchingPgMajor(15, 15), 15);
  assert.equal(checkedMatchingPgMajor(17, 17), 17);
  for (const pair of [[17, 15], [15, 17], [16, 16], [18, 18]]) {
    assert.throws(() => checkedMatchingPgMajor(...pair), /GPS CI PostgreSQL client\/server major mismatch/);
  }
});

test('GPS CI defers only the PG15 GraphQL wrapper ACL and retains all other grants', () => {
  const special = '3664; 0 0 ACL graphql_public FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb) supabase_admin';
  const other = '3665; 0 0 ACL public TABLE vehicles postgres';
  const result = splitPgGraphqlAclToc(`; archive\n${special}\n${other}\n`);
  assert.equal(result.deferred, `${special}\n`);
  assert.equal(result.main, `; archive\n${other}\n`);
  assert.throws(() => splitPgGraphqlAclToc(other), /expected one Supabase pg_graphql wrapper ACL/);
  assert.throws(() => splitPgGraphqlAclToc(`${special}\n${special}`), /expected one Supabase pg_graphql wrapper ACL/);
});

const graphqlIdentity='a'.repeat(32)+'|'+'b'.repeat(32);
const graphqlDefinition='CREATE OR REPLACE FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) RETURNS jsonb LANGUAGE sql AS $$ SELECT null::jsonb $$;';
const graphqlAcl='3664; 0 0 ACL graphql_public FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb) supabase_admin';
const otherAcl='3665; 0 0 ACL public TABLE vehicles postgres';
const graphqlToc=`; archive\n${graphqlAcl}\n${otherAcl}\n`;
const zeroToc=`; archive\n${otherAcl}\n`;
const noInitial={owner:'supabase_admin',initialAclCount:0,initialAclHash:null};
const matchingInitial={owner:'supabase_admin',initialAclCount:1,initialAclHash:'b'.repeat(32)};
const graphqlSnapshot=(facts=noInitial)=>({extension:'pg_graphql',identity:graphqlIdentity,definition:graphqlDefinition,...facts});
function graphqlSource(sql){
 if(sql.includes("jsonb_build_object('owner'"))return JSON.stringify(noInitial);
 if(sql.includes('select e.extname'))return 'pg_graphql';
 if(sql.includes('select md5('))return graphqlIdentity;
 if(sql.includes('select pg_get_functiondef('))return graphqlDefinition;
 throw Error('Unexpected fake source read');
}
async function fakeRestore({snapshot=graphqlSnapshot(),toc=graphqlToc,calls=[],gap='t',
 createdIdentity=graphqlIdentity,createdOwner='supabase_admin',finalIdentity=graphqlIdentity,
 finalOwner='supabase_admin',extension='pg_graphql',initial=matchingInitial}={}){
 let enrolled=false;
 await restoreGpsCloneArchive({major:15,graphqlSnapshot:snapshot,readToc:async()=>toc,
  restoreArchive:async list=>calls.push(list.includes('TABLE vehicles')?'MAIN':'ACL'),
  targetQuery:async sql=>{
   if(sql.includes('is null')){calls.push('GAP');return gap;}
   if(sql.startsWith('CREATE OR REPLACE')){calls.push('WRAPPER');assert.equal(sql.trim(),graphqlDefinition);return '';}
   if(sql.startsWith('alter extension')){calls.push('EXTENSION');enrolled=true;return '';}
   if(sql.includes('select e.extname')){calls.push('CHECK_EXTENSION');return extension;}
   if(sql.includes("jsonb_build_object('owner'")){calls.push('CHECK_INITIAL');return JSON.stringify(initial);}
   if(sql.includes('select md5(')){calls.push(enrolled?'CHECK_IDENTITY':'CHECK_CREATED_IDENTITY');return enrolled?finalIdentity:createdIdentity;}
   if(sql.includes('select pg_get_userbyid')){calls.push(enrolled?'CHECK_OWNER':'CHECK_CREATED_OWNER');return enrolled?finalOwner:createdOwner;}
   throw Error('Unexpected fake restore query');
  }
 });
 return calls;
}
test('PG15 capture reads owner and exact initial ACL metadata without creating anything',async()=>{
 const reads=[];
 const snapshot=await captureGpsCloneGraphql({major:15,query:sql=>{reads.push(sql);return graphqlSource(sql);}});
 assert.deepEqual(snapshot,graphqlSnapshot());
 assert.equal(reads.length,4);assert.ok(reads.every(sql=>sql.startsWith('select ')));
 assert.doesNotMatch(reads.join('\n'),/create function|begin;|rollback;/i);
 const initial=reads.find(sql=>sql.includes('initialAclCount'));
 assert.match(initial,/count\(\*\).*classoid='pg_proc'::regclass and i.objoid=p.oid\)/);
 assert.match(initial,/i.objsubid=0 and i.privtype='e'/);
});
test('the pinned application PG15 baseline preserves the single deferred ACL sequence',async()=>{
 const config=readFileSync('supabase/config.toml','utf8');const major=Number(config.match(/^major_version\s*=\s*(\d+)/m)?.[1]);
 assert.equal(major,15,'Changing the application PostgreSQL major requires separate review');
 assert.deepEqual(await fakeRestore({createdIdentity:'a'.repeat(32)+'|'+'c'.repeat(32)}),
  ['MAIN','GAP','WRAPPER','CHECK_CREATED_IDENTITY','CHECK_CREATED_OWNER','EXTENSION','ACL','CHECK_EXTENSION','CHECK_IDENTITY','CHECK_OWNER']);
 const lifecycle=readFileSync('scripts/ci-disposable-gps-database.mjs','utf8'),races=readFileSync('scripts/verify-demo-pilot-owner-concurrency-local.mjs','utf8');
 for(const source of [lifecycle,races])assert.match(source,/await restoreGpsCloneArchive\(/);
 assert.match(races,/checkedMatchingPgMajor\(clientMajor,check\.major\)/);assert.doesNotMatch(races,/check\.major\s*!==\s*17/);
 assert.doesNotMatch(lifecycle,/proveGpsCloneGraphqlCreation/,'unchanged primary capture must remain read-only');
 assert.ok(races.indexOf('await proveGpsCloneGraphqlCreation(')<races.indexOf("stage='COMMITTED_FIXTURE_GENERATE'"));
});
test('PG15 zero ACL entries require matching exact initial privileges and preserve every other grant',async()=>{
 const snapshot=graphqlSnapshot(matchingInitial),result=checkedGpsCloneArchive({major:15,graphqlSnapshot:snapshot,toc:zeroToc});
 assert.equal(result.main,zeroToc);assert.equal(result.deferred,null);
 assert.deepEqual(result.diagnostic,{mode:'INITIAL_WRAPPER_ACL',exactAclEntries:'zero',relatedAclEntries:'zero',initialAclRows:'one',currentMatchesInitial:true,expectedOwner:true});
 assert.deepEqual(await fakeRestore({snapshot,toc:zeroToc}),
  ['MAIN','GAP','WRAPPER','CHECK_CREATED_IDENTITY','CHECK_CREATED_OWNER','EXTENSION','CHECK_EXTENSION','CHECK_IDENTITY','CHECK_OWNER','CHECK_INITIAL']);
});
test('PG15 unknown, duplicate and mismatched wrapper ACL entries always refuse',()=>{
 const snapshot=graphqlSnapshot(matchingInitial);
 for(const toc of [graphqlAcl+'\n'+graphqlAcl,graphqlAcl+'\n'+graphqlAcl.replace('supabase_admin','other_owner'),
  graphqlAcl.replace('supabase_admin','other_owner'),graphqlAcl.replace('"operationName"','operationName'),
  graphqlAcl.replace('extensions jsonb','extensions text'),graphqlAcl.replace('FUNCTION graphql(','FUNCTION "graphql"('),
  graphqlAcl.replace('graphql_public FUNCTION graphql(','- FUNCTION graphql_public.graphql('),
  graphqlAcl.replace('FUNCTION graphql(','ROUTINE graphql('),graphqlAcl.replace('FUNCTION graphql(','UNKNOWN graphql(')]){
  assert.throws(()=>checkedGpsCloneArchive({major:15,graphqlSnapshot:snapshot,toc}),/expected one Supabase pg_graphql wrapper ACL/);
 }
 for(const facts of [noInitial,{...matchingInitial,initialAclHash:'c'.repeat(32)}]){
  assert.throws(()=>checkedGpsCloneArchive({major:15,graphqlSnapshot:graphqlSnapshot(facts),toc:zeroToc}),/expected one Supabase pg_graphql wrapper ACL/);
 }
 const diagnostic=gpsCloneGraphqlArchiveDiagnostic({major:15,graphqlSnapshot:snapshot,toc:graphqlAcl+'\n'+graphqlAcl});
 assert.deepEqual(diagnostic,{mode:'REFUSED',exactAclEntries:'multiple',relatedAclEntries:'multiple',initialAclRows:'one',currentMatchesInitial:true,expectedOwner:true});
 assert.doesNotMatch(JSON.stringify(diagnostic),/supabase_admin|[a-f0-9]{32}|CREATE|operationName/);
});
test('PG15 snapshot denies missing, malformed, duplicate or wrong-owner metadata before restoring',async()=>{
 const snapshot=graphqlSnapshot();let restores=0;
 for(const value of [{...snapshot,extension:'public'},{...snapshot,identity:'PRIVATE_SENTINEL'},
  {...snapshot,definition:'SELECT PRIVATE_SENTINEL'},{...snapshot,initialAclCount:undefined},
  {...snapshot,initialAclCount:2,initialAclHash:'b'.repeat(32)},{...snapshot,initialAclCount:1,initialAclHash:null},
  {...snapshot,initialAclCount:0,initialAclHash:'b'.repeat(32)},{...snapshot,initialAclCount:'1'},
  {...snapshot,initialAclCount:1,initialAclHash:'PRIVATE_SENTINEL'}]){
  await assert.rejects(restoreGpsCloneArchive({major:15,graphqlSnapshot:value,readToc:async()=>graphqlToc,restoreArchive:async()=>{restores++;}}),/invalid pg_graphql restore snapshot/);
 }
 await assert.rejects(restoreGpsCloneArchive({major:15,graphqlSnapshot:{...snapshot,owner:'other_owner'},restoreArchive:async()=>{restores++;}}),/owner mismatch/);
 assert.equal(restores,0);
 await assert.rejects(captureGpsCloneGraphql({major:15,query:sql=>sql.includes("jsonb_build_object('owner'")?'PRIVATE_SENTINEL':graphqlSource(sql)}),/invalid pg_graphql restore snapshot/);
});
test('fresh ACL proof is a bounded rollback-only harmless creation in the same owner and schema',async()=>{
 const queries=[];
 for(const database of ['loadgistic_pilot_ci','loadgistic_telematics_ci']){
  assert.equal(await proveGpsCloneGraphqlCreation({database,graphqlSnapshot:graphqlSnapshot(matchingInitial),query:async sql=>{queries.push(sql);return 'b'.repeat(32)+'|supabase_admin';}}),true);
 }
 for(const sql of queries){
  assert.match(sql,/^begin;set local statement_timeout='5s';set local lock_timeout='2s';/);
  assert.match(sql,/current_database\(\)<>'loadgistic_(?:pilot|telematics)_ci' or current_user<>'supabase_admin'/);
  assert.match(sql,/create function graphql_public\.loadgistic_acl_probe_[a-f0-9]{32}\(\) returns jsonb language sql as 'select null::jsonb';/);
  assert.match(sql,/rollback;$/);assert.doesNotMatch(sql,/select graphql_public|alter extension|\bcommit\b/i);
 }
 assert.notEqual(queries[0].match(/create function ([^(]+)/)[1],queries[1].match(/create function ([^(]+)/)[1]);
 let called=false;
 for(const database of ['postgres','production','loadgistic_pilot_ci;commit','']){
  await assert.rejects(proveGpsCloneGraphqlCreation({database,graphqlSnapshot:graphqlSnapshot(matchingInitial),query:()=>{called=true;}}),/disposable GraphQL probe database required/);
 }
 assert.equal(called,false);
 await assert.rejects(proveGpsCloneGraphqlCreation({database:'loadgistic_pilot_ci',graphqlSnapshot:graphqlSnapshot(matchingInitial),query:async()=> 'c'.repeat(32)+'|supabase_admin'}),/fresh GraphQL wrapper ACL differs from source/);
 await assert.rejects(proveGpsCloneGraphqlCreation({database:'loadgistic_pilot_ci',graphqlSnapshot:graphqlSnapshot(matchingInitial),query:async()=> 'b'.repeat(32)+'|other_owner'}),/fresh GraphQL wrapper ACL differs from source/);
});
test('fresh wrapper owner, body and omitted-ACL defaults are checked before extension enrollment',async()=>{
 for(const options of [{gap:'f'},{createdOwner:'other_owner'},{createdIdentity:'c'.repeat(32)+'|'+'b'.repeat(32)},
  {snapshot:graphqlSnapshot(matchingInitial),toc:zeroToc,createdIdentity:'a'.repeat(32)+'|'+'c'.repeat(32)}]){
  const calls=[];
  await assert.rejects(fakeRestore({...options,calls}),/restore gap changed|owner mismatch|fresh GraphQL wrapper ACL differs/);
  assert.equal(calls.includes('EXTENSION'),false);assert.equal(calls.includes('ACL'),false);
 }
});
test('final wrapper definition, ACL, owner, membership and zero-path initial ACL drift remain failures',async()=>{
 for(const options of [{finalIdentity:'c'.repeat(32)+'|'+'b'.repeat(32)},
  {finalIdentity:'a'.repeat(32)+'|'+'c'.repeat(32)},{finalOwner:'other_owner'},{extension:'other_extension'}]){
  await assert.rejects(fakeRestore(options),/definition or grants differ/);
 }
 for(const initial of [{...matchingInitial,initialAclCount:0,initialAclHash:null},
  {...matchingInitial,initialAclHash:'c'.repeat(32)},{...matchingInitial,owner:'other_owner'}]){
  await assert.rejects(fakeRestore({snapshot:graphqlSnapshot(matchingInitial),toc:zeroToc,initial}),/initial privileges differ/);
 }
});
test('PG17 archive restoration stays direct and unreviewed versions refuse before a restore',async()=>{
 const calls=[];assert.equal(await captureGpsCloneGraphql({major:17,query:()=>{throw Error('Unexpected PG15 read');}}),null);
 assert.equal(gpsCloneGraphqlArchiveDiagnostic({major:17}),null);
 await restoreGpsCloneArchive({major:17,restoreArchive:async list=>calls.push(list),readToc:()=>{throw Error('Unexpected PG15 TOC');}});
 assert.deepEqual(calls,[null]);
 await assert.rejects(restoreGpsCloneArchive({major:16,restoreArchive:async()=>calls.push('UNSAFE')}),/client\/server major mismatch/);assert.deepEqual(calls,[null]);
});
