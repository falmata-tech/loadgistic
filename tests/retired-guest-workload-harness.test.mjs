import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {retirementProbeSql,retirementFailureCode,verifyRetiredGuestWorkload} from '../scripts/verify-retired-guest-workload-local.mjs';

const sources={
 migration:readFileSync(new URL('../supabase/migrations/152_retire_guest_support_workload.sql',import.meta.url),'utf8'),
 setup:readFileSync(new URL('../tests/sql/retire-guest-support-workload-setup.sql',import.meta.url),'utf8'),
 assertions:readFileSync(new URL('../tests/sql/retire-guest-support-workload-assert.sql',import.meta.url),'utf8')
};
test('the exact migration executes twice inside one rollback-only transaction after setup and before assertions',()=>{
 const sql=retirementProbeSql(sources),body=sources.migration.replace(/^[ \t]*(?:begin|commit);[ \t]*$/gmi,'');
 assert.equal(sql.split(body).length-1,2);assert.equal(sql.split(sources.setup).length-1,1);assert.equal(sql.split(sources.assertions).length-1,1);
 assert.ok(sql.indexOf(sources.setup)<sql.indexOf(body));assert.ok(sql.lastIndexOf(body)<sql.indexOf(sources.assertions));
 assert.equal((sql.match(/^begin;$/gmi)||[]).length,1);assert.equal((sql.match(/^rollback;$/gmi)||[]).length,1);assert.doesNotMatch(sql,/^commit;$/mi);
 assert.match(sql,/rollback;\nselect 'RETIRED_GUEST_WORKLOAD_ROLLBACK_OK';\n$/);assert.match(sql,/set local statement_timeout='15s'/);
});
test('changed migration or fixture transaction/meta commands cannot escape the protected composition',()=>{
 assert.throws(()=>retirementProbeSql({...sources,migration:sources.migration+'\n-- changed artifact'}),/MIGRATION_DIGEST_CHANGED/);
 for(const key of['setup','assertions'])for(const command of['commit;','rollback;','end;','\\connect remote'])assert.throws(()=>retirementProbeSql({...sources,[key]:sources[key]+'\n'+command+'\n'}),/FIXTURE_BOUNDARY_INVALID/);
 for(const key of['setup','assertions'])for(const command of['select 1; commit;','-- changed fixture'])assert.throws(()=>retirementProbeSql({...sources,[key]:sources[key]+'\n'+command+'\n'}),/FIXTURE_DIGEST_CHANGED/);
});
test('only the fixed Loadgistic Docker label can reach the fixed local PostgreSQL command',()=>{
 let calls=0;assert.throws(()=>verifyRetiredGuestWorkload(()=>{calls++;return{status:0,stdout:'another-project\n'};}),/LOCAL_CONTAINER_REQUIRED/);assert.equal(calls,1);
 const result=verifyRetiredGuestWorkload((program,args,options)=>{
  assert.equal(program,'docker');calls++;assert.ok(args.includes('supabase_db_loadgistic-local'));
  if(args[0]==='inspect')return{status:0,stdout:'loadgistic-local\n'};
  assert.deepEqual(args,['exec','-i','supabase_db_loadgistic-local','psql','-XAtq','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']);
  assert.equal(options.input,retirementProbeSql(sources));return{status:0,stdout:'\nRETIRED_GUEST_WORKLOAD_ROLLBACK_OK\n'};
 });assert.deepEqual(result,{ok:true,migration:152,passes:2,rollback:true});
});
test('SQL failures retain only bounded codes and cannot disclose row or contact diagnostics',()=>{
 assert.equal(retirementFailureCode('ERROR:  P0001: RETIREMENT_TOUCHED_PROVIDER\nCONTEXT: secret@example.test'),'P0001:RETIREMENT_TOUCHED_PROVIDER');
 assert.equal(retirementFailureCode('ERROR:  23503: insert/update violates private foreign key\nDETAIL: private@example.test'),'SQLSTATE_23503');
 assert.equal(retirementFailureCode('private@example.test synthetic-token'),'RETIRED_GUEST_PROBE_FAILED');
 let stage=0;assert.throws(()=>verifyRetiredGuestWorkload(()=>++stage===1?{status:0,stdout:'loadgistic-local\n'}:{status:1,stderr:'ERROR:  23503: private@example.test'}),/^Error: SQLSTATE_23503$/);
});
test('a success exit without the post-rollback marker never passes the verifier',()=>{
 let stage=0;assert.throws(()=>verifyRetiredGuestWorkload(()=>++stage===1?{status:0,stdout:'loadgistic-local\n'}:{status:0,stdout:''}),/ROLLBACK_NOT_CONFIRMED/);
});
