import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requireTeamCreator} from '../src/lib/support/team-authorization.js';

test('team provisioning denies non-admin callers before even querying authority',async()=>{
  const client={from(){assert.fail('An unauthorized session must not reach the provider');}};
  for(const user of [null,{},...['DRIVER','SUPPORT','TRANSPORTER'].map(role=>({id:'actor',role}))]){
    await assert.rejects(requireTeamCreator(client,user),/FORBIDDEN/);
  }
});

test('persisted active administrator authority must pass before external provisioning',async()=>{
  for(const result of [{data:null,error:null},{data:{id:'actor'},error:{message:'unavailable'}},{data:{id:'actor'},error:null}]){
    const filters=[];
    const query={select(){return this;},eq(...pair){filters.push(pair);return this;},async maybeSingle(){return result;}};
    const client={from(table){assert.equal(table,'profiles');return query;}};
    const check=requireTeamCreator(client,{id:'actor',role:'ADMIN'});
    if(result.data&&!result.error)await check;else await assert.rejects(check,/FORBIDDEN/);
    assert.deepEqual(filters,[['id','actor'],['role','ADMIN'],['active',true]]);
  }
  const source=readFileSync(new URL('../src/lib/support/supabase.js',import.meta.url),'utf8');
  const command=source.slice(source.indexOf('export async function createSupportAgent'));
  assert.ok(command.indexOf('await requireTeamCreator(client,user)')<command.indexOf('auth.admin.createUser'));
});
