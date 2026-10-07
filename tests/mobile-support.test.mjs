import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
const source = readFileSync('src/lib/mobile/support-contract.ts', 'utf8').replace("import { z } from 'zod';", '').replaceAll('export ', '');
const { startSupport, supportCommand, supportQuery, supportCursor, supportSummary, supportThread } = new Function('z', ts.transpile(source) + ';return {startSupport,supportCommand,supportQuery,supportCursor,supportSummary,supportThread};')(z);
test('member support accepts only bounded topics/messages and explicit closure', () => {
 assert.equal(startSupport.safeParse({category:'CAPACITY',body:' Help with my truck '}).data.body,'Help with my truck');
 for(const input of [{category:'STAFF',body:'Help'},{category:'ACCOUNT',body:' '},{category:'ACCOUNT',body:'a'.repeat(2001)},{category:'ACCOUNT',body:'Help',actorId:'another'}]) assert.equal(startSupport.safeParse(input).success,false);
 assert.equal(supportCommand.safeParse({action:'END',confirm:true}).success,true);
 for(const input of [{action:'END',confirm:false},{action:'END'},{action:'CLAIM'},{action:'SEND',body:'Reply',assignedAgent:'forged'}]) assert.equal(supportCommand.safeParse(input).success,false);
 assert.equal(supportQuery.safeParse({page:'-1'}).success,false); assert.equal(supportQuery.safeParse({view:'ASSIGNED'}).success,false); assert.equal(supportCursor.safeParse({before:'invalid'}).success,false);
});
test('member transcript projection excludes staff/private identifiers and requires ownership', () => {
 const raw={id:'chat',customer_user_id:'member',assigned_agent_user_id:'staff-secret',assigned_agent_name:'Help team',status:'OPEN',events:[{private:'secret'}],messages:[{id:'message',sender_user_id:'member',body:'My request',file_path:'secret',attachment_id:'file',attachment_name:'receipt.pdf',created_at:'now'},{id:'reply',sender_user_id:'staff-secret',body:'We can help'}],has_older:true,next_before:'cursor'};
 const value=supportThread(raw,'member'); assert.equal(value.messages[0].mine,true); assert.equal(value.messages[1].mine,false); assert.equal(value.nextBefore,'cursor'); assert.deepEqual(value.messages[0].attachment,{id:'file',name:'receipt.pdf'});
 assert.equal(JSON.stringify(value).includes('secret'),false); assert.equal('customer_user_id' in supportSummary(raw),false); assert.throws(()=>supportThread(raw,'outsider'),/NOT_FOUND/);
});
