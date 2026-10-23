import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {documentReviewSummary,verificationBadgesFromApproved,truckAuthorizationBadgeFromApproved} from '../src/lib/verification-summary.js';

test('no documents and expired approvals never light up as reviewed',()=>{
  assert.deepEqual(documentReviewSummary([]),{reviewed:0,total:0,complete:false});
  for(const subject of ['DRIVER','PROVIDER_PROFILE','VEHICLE','ORGANIZATION']){
    const summary=documentReviewSummary(verificationBadgesFromApproved(subject,[]));
    assert.equal(summary.reviewed,0);
    assert.equal(summary.complete,false);
  }
  const badges=verificationBadgesFromApproved('DRIVER',[
    {verification_type:'IDENTITY',reviewed_at:'2026-01-01',expires_on:'2099-01-01'},
    {verification_type:'DRIVER_IDENTITY',reviewed_at:'2020-01-01',expires_on:'2020-02-01'}
  ]);
  assert.deepEqual(documentReviewSummary(badges),{reviewed:1,total:2,complete:false});
  assert.equal(badges[1].expired,true);
  assert.equal(truckAuthorizationBadgeFromApproved([{verification_type:'VEHICLE_AUTHORIZATION',related_vehicle_id:'other-truck'}],'this-truck').verified,false);
});

test('driver eligibility guards publication and both maps without document prerequisites',()=>{
  const sql=fs.readFileSync(new URL('../supabase/migrations/078_capacity_driver_eligibility.sql',import.meta.url),'utf8');
  assert.match(sql,/driver\.active and driver\.role='DRIVER'/);
  assert.match(sql,/fleet_driver\.organization_id=vehicle\.organization_id/);
  assert.match(sql,/assignment\.vehicle_id=vehicle\.id and assignment\.active/);
  assert.match(sql,/then provider\.user_id else assignment\.driver_user_id/);
  for(const name of ['publish_provider_capacity','public_capacity_page','private_capacity_projection','provider_capacity_workspace','refresh_provider_capacity_location','set_provider_assigned_vehicle_duty'])assert.ok(sql.includes(name),name);
  assert.doesNotMatch(sql,/verification_requests|license_verified|verified_identity/);
  assert.match(sql,/revoke all on function public\.capacity_active_driver_id\(uuid\) from public,anon,authenticated/);
  const workflow=fs.readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
  assert.match(workflow,/tests\/sql\/capacity-driver-eligibility\.sql/);
});
