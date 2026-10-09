import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const env=readFileSync(new URL('../.env.local',import.meta.url),'utf8');
assert.ok(/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m.test(env),'Loadgistic local services required');
const key=env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'');assert.ok(key);
const options={auth:{persistSession:false,autoRefreshToken:false}},db=createClient('http://127.0.0.1:55321',key,options),other=createClient('http://127.0.0.1:55321',key,options),users=[],chat=randomUUID();
function checked(result){if(result.error)throw Error('LOCAL_FIXTURE_FAILED');return result.data;}
async function identity(){const user=checked(await db.auth.admin.createUser({email:`receipt-race-${randomUUID()}@example.test`,email_confirm:true})).user;users.push(user.id);return user.id;}
try{
 const customer=await identity(),agent=await identity(),admin=checked(await db.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single()).id;
 checked(await db.from('profiles').update({role:'DRIVER',active:true}).eq('id',customer));
 checked(await db.rpc('create_managed_support_agent',{actor_user_id:admin,agent_auth_user_id:agent,command:{name:'Receipt concurrency fixture',email:checked(await db.auth.admin.getUserById(agent)).user.email,can_manage_support:true,available:false}}));
 checked(await db.from('support_conversations').insert({id:chat,customer_user_id:customer,assigned_agent_user_id:agent,category:'ACCOUNT',status:'OPEN'}));
 checked(await db.from('support_messages').insert([{conversation_id:chat,sender_user_id:customer,body:'First race fixture'},{conversation_id:chat,sender_user_id:agent,body:'Second race fixture'}]));
 const acknowledge=(client,actor,sequence)=>client.rpc('acknowledge_visible_chat_read',{chat_kind:'SUPPORT',target_id:chat,actor_user_id:actor,access_digest:null,through_sequence:sequence,expected_assignment_version:0});
 for(const result of await Promise.all([acknowledge(db,customer,2),acknowledge(other,customer,1),acknowledge(db,agent,1),acknowledge(other,agent,2),acknowledge(other,customer,0),acknowledge(db,agent,0)]))checked(result);
 const state=checked(await db.rpc('chat_read_state',{chat_kind:'SUPPORT',target_id:chat,actor_user_id:agent}));assert.equal(state.customerSeen,2);assert.equal(state.teamSeen,2);assert.equal(state.ownSeen,2);assert.equal(state.teamJoined,true);
 assert.equal(checked(await db.from('support_messages').select('id').eq('conversation_id',chat)).length,2);
 console.log('PASS: concurrent opposite-side and reordered visible-read commands preserve maximum cursors, current-agent unread, joined state and exact messages');
}catch(error){throw Error('LOCAL_RECEIPT_CONCURRENCY_FAILED: '+error.name);}
finally{
 checked(await db.from('support_conversations').delete().eq('id',chat));
 assert.equal(checked(await db.from('support_chat_read_cursors').select('participant').eq('conversation_id',chat)).length,0);
 for(const id of users){checked(await db.from('audit_logs').delete().eq('actor_user_id',id));checked(await db.from('audit_logs').delete().eq('entity_id',id));checked(await db.auth.admin.deleteUser(id));}
 console.log('CLEANUP: exact local receipt fixture and identities; cursors removed with their parent');
}
