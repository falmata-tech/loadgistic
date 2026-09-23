import test from 'node:test';
import assert from 'node:assert/strict';
import {readWindowedPage} from '../src/lib/pagination.js';
import {reviewQueuePath,reviewQueueReturnPath,reviewQueueStatus} from '../src/lib/review-navigation.js';
import {projectVerificationSubject} from '../src/lib/verification-summary.js';

test('queue recovery fetches at most two bounded pages without losing its caller filter',async()=>{
  const calls=[];
  const result=await readWindowedPage(async(offset,limit)=>{calls.push({offset,limit});return offset?[]:[{payload:{id:'match'},total_count:31}];},{page:99,pageSize:12});
  assert.deepEqual(calls,[{offset:1176,limit:12},{offset:0,limit:12}]);
  assert.deepEqual(result,{items:[{id:'match'}],page:1,pageSize:12,total:31,pageCount:3});
});

test('a normal queue page does not reread and malformed offsets cannot reach the RPC',async()=>{
  for(const value of ['NaN','Infinity',-1,0,1.5,Number.MAX_SAFE_INTEGER,'invalid']){
    const calls=[];const result=await readWindowedPage(async(offset,limit)=>{calls.push([offset,limit]);return [];},{page:value,pageSize:Infinity});
    assert.deepEqual(calls,[[0,12]]);assert.equal(result.page,1);assert.equal(result.total,0);
  }
  const calls=[];const result=await readWindowedPage(async(offset,limit)=>{calls.push([offset,limit]);return [{payload:{id:'last'},total_count:60}];},{page:2,pageSize:100});
  assert.deepEqual(calls,[[50,50]]);assert.equal(result.page,2);
});

test('queue read failures remain failures, including recovery failure',async()=>{
  await assert.rejects(()=>readWindowedPage(async()=>{throw new Error('DENIED');},{page:2}),/DENIED/);
  await assert.rejects(()=>readWindowedPage(async offset=>{if(offset)return [];throw new Error('READ_FAILED');},{page:2}),/READ_FAILED/);
});

test('review redirects retain only matching queue context',()=>{
  const expected='/admin/reviews?tab=documents&status=MORE_INFO&q=Audit+file&page=3';
  assert.equal(reviewQueueReturnPath('/admin/reviews?tab=documents&status=MORE_INFO&q=Audit%20file&page=3&success=spoof#bad','documents'),expected);
  assert.equal(reviewQueuePath('ratings',{q:'not searchable',status:'REMOVED',page:2}),'/admin/reviews?tab=ratings&status=REMOVED&page=2');
  for(const bad of ['https://evil.test/admin/reviews?tab=documents','//evil.test/admin/reviews','/\\evil.test','/admin/operations','/admin/reviews/../settings','/admin/reviews?tab=payments']){
    assert.equal(reviewQueueReturnPath(bad,'documents'),'/admin/reviews?tab=documents&status=ALL&page=1');
  }
  assert.equal(reviewQueueStatus('ratings','APPROVED'),'PENDING');assert.equal(reviewQueueStatus('payments','INVALID'),'ALL');
});

test('authorization choices exclude current approvals while preserving badges and allowing renewal',()=>{
  const subject={subject_type:'PROVIDER_PROFILE',verification_types:['IDENTITY','DRIVER_IDENTITY','VEHICLE_AUTHORIZATION'],
    vehicles:[{id:'approved',label:'Approved truck'},{id:'expired',label:'Expired truck'},{id:'new',label:'New truck'}],
    approved_documents:[{verification_type:'VEHICLE_AUTHORIZATION',related_vehicle_id:'approved',expires_on:'2099-01-01'},
      {verification_type:'VEHICLE_AUTHORIZATION',related_vehicle_id:'expired',expires_on:'2000-01-01'}]};
  const result=projectVerificationSubject(subject);
  assert.deepEqual(result.vehicles.map(v=>v.id),['expired','new']);
  assert.ok(result.allowed_types.includes('VEHICLE_AUTHORIZATION'));
  assert.equal(result.badges.find(b=>b.vehicleId==='approved').verified,true);
  assert.equal(result.badges.find(b=>b.vehicleId==='expired').expired,true);
  assert.equal(result.badges.filter(b=>b.type==='TRUCK_AUTHORIZATION').length,3);
  const complete=projectVerificationSubject({...subject,vehicles:[subject.vehicles[0]]});
  assert.equal(complete.allowed_types.includes('VEHICLE_AUTHORIZATION'),false);assert.deepEqual(complete.vehicles,[]);
});


test('pending choices stay scoped to subject and pairing without becoming approvals',()=>{
  const subject={subject_type:'PROVIDER_PROFILE',subject_id:'driver',verification_types:['IDENTITY','DRIVER_IDENTITY','VEHICLE_AUTHORIZATION'],vehicles:[{id:'one',label:'One'},{id:'two',label:'Two'}]};
  const pending=[{subject_type:'PROVIDER_PROFILE',subject_id:'driver',status:'PENDING',verification_type:'IDENTITY'},
    {subject_type:'PROVIDER_PROFILE',subject_id:'driver',status:'PENDING',verification_type:'VEHICLE_AUTHORIZATION',related_vehicle_id:'one'},
    {subject_type:'PROVIDER_PROFILE',subject_id:'other',status:'PENDING',verification_type:'DRIVER_IDENTITY'},
    {subject_type:'PROVIDER_PROFILE',subject_id:'driver',status:'MORE_INFO',verification_type:'DRIVER_IDENTITY'}];
  const result=projectVerificationSubject(subject,pending);
  assert.deepEqual(result.allowed_types,['DRIVER_IDENTITY','VEHICLE_AUTHORIZATION']);
  assert.deepEqual(result.vehicles.map(item=>item.id),['two']);
  assert.equal(result.pending_count,2);
  assert.ok(result.badges.every(badge=>!badge.verified));
  assert.ok(projectVerificationSubject(subject,pending.map(item=>({...item,status:'REJECTED'}))).allowed_types.includes('IDENTITY'));
});
