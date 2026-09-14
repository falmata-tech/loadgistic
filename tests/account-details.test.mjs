import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAccountDetails,canEditAccountDetails} from '../src/lib/account-details.js';

test('Account accepts trimmed international names and optional private phones',()=>{
  assert.deepEqual(parseAccountDetails({name:'  አበበ Test  ',phone:' +251 (911) 000-000 '}),{name:'አበበ Test',phone:'+251 (911) 000-000'});
  assert.deepEqual(parseAccountDetails({name:'Test Driver',phone:'  '}),{name:'Test Driver',phone:''});
});
test('Account rejects authority fields, malformed values and punctuation-only phones',()=>{
  for(const input of [null,[],{}, {name:'x',phone:''},{name:'x'.repeat(101),phone:''},
    {name:'Test\nDriver',phone:''},{name:'Test Driver',phone:'-------'},
    {name:'Test Driver',phone:'+251'}, {name:'Test Driver',phone:'1234567<script>'},
    {name:'Test Driver',phone:'1'.repeat(33)}, {name:'Test Driver',phone:1234567},
    ...['id','actor_user_id','role','active','email','organization_id'].map(key=>({name:'Test',phone:'', [key]:'tampered'}))]){
    assert.throws(()=>parseAccountDetails(input),/INVALID_ACCOUNT_DETAILS/);
  }
});
test('Account maintenance requires active role but not subscription or operational permissions',()=>{
  for(const role of ['DRIVER','TRANSPORTER','ADMIN']){
    assert.equal(canEditAccountDetails({role,active:true,can_manage_capacity:false}),true);
    assert.equal(canEditAccountDetails({role,active:false}),false);
  }
  for(const user of [null,{}, {active:true,role:'SUPPORT'}, {active:true,role:'BUSINESS'}])assert.equal(canEditAccountDetails(user),false);
});
test('Account migration changes only self editing and the reviewed fleet phone write',()=>{
  const read=file=>readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8');
  const migration=read('086_account_details.sql');const original=read('081_fleet_driver_onboarding.sql');
  const body=source=>source.slice(source.indexOf('function public.fleet_update_driver_contact('),source.indexOf('\nend $$;',source.indexOf('function public.fleet_update_driver_contact('))+10).trim();
  assert.equal(body(migration),body(original).replace('set full_name=name_value,phone=phone_value where id=driver_id','set full_name=name_value where id=driver_id'));
  assert.equal((migration.match(/create (or replace )?function/g)||[]).length,2);
  assert.match(migration,/from public,anon,authenticated/);
});
