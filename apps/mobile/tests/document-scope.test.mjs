import test from 'node:test';
import assert from 'node:assert/strict';
import {documentSubjects} from '../src/navigation/document-scope.ts';
test('contextual document panels never mix a truck with another subject or kind',()=>{
 const subjects=[{id:'same',kind:'VEHICLE'},{id:'same',kind:'DRIVER'},{id:'other',kind:'VEHICLE'},{id:'company',kind:'ORGANIZATION'},{id:'profile',kind:'PROVIDER_PROFILE'}];
 assert.deepEqual(documentSubjects(subjects,{kind:'ENTITY',subjectKind:'VEHICLE',id:'same'}),[subjects[0]]);
 assert.deepEqual(documentSubjects(subjects,{kind:'ENTITY',subjectKind:'DRIVER',id:'same'}),[subjects[1]]);
 for(const id of ['','missing'])assert.deepEqual(documentSubjects(subjects,{kind:'ENTITY',subjectKind:'VEHICLE',id}),[]);
 assert.deepEqual(documentSubjects(subjects,{kind:'ACCOUNT',includeDriver:false}),[subjects[3],subjects[4]]);
 assert.deepEqual(documentSubjects(subjects,{kind:'ACCOUNT',includeDriver:true}),[subjects[1],subjects[3],subjects[4]]);
 assert.equal(documentSubjects(subjects),subjects);
 assert.equal(subjects.length,5);
});
