import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fleetReturnPath} from '../src/lib/fleet-navigation.js';
import {buildEmailMessage} from '../src/lib/email-templates.js';

test('Fleet redirects keep truck/pagination context without accepting external destinations',()=>{
  const id='12345678-1234-1234-1234-123456789012';
  assert.equal(fleetReturnPath(`/app/fleet?driverPage=3&vehicle=${id}&success=spoof#driver-access`),`/app/fleet?driverPage=3&vehicle=${id}#driver-access`);
  assert.equal(fleetReturnPath(`/app/fleet/${id}`),`/app/fleet/${id}`);
  for(const unsafe of ['https://example.com','//example.com','/\\example.com','/admin','/api/auth/logout','/app/fleet/../../admin'])assert.equal(fleetReturnPath(unsafe),'/app/fleet');
});

test('Fleet invitation email explains consent and escapes provider content',()=>{
  const result=buildEmailMessage({template:'fleet-driver-invitation',to:'driver@example.test',organizationName:'Fleet <script>',url:'https://example.test/join-fleet'});
  assert.match(result.text,/Company driver/);assert.match(result.text,/seven days/);
  assert.match(result.html,/Fleet &lt;script&gt;/);assert.doesNotMatch(result.html,/<script>/);
  assert.match(result.text,/assign your truck after you accept/);
});

test('OTP and OAuth complete identity verification before offering fleet acceptance',()=>{
  for(const file of ['src/app/api/auth/callback/route.ts','src/app/api/applications/email-otp/verify/route.ts']){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    assert.ok(source.indexOf('hasJoinableFleetInvitation(data.user.id)')>source.indexOf('const projection='));
    assert.ok(source.indexOf("redirectUrl(request,'/join-fleet')")<source.indexOf("redirectUrl(request,'/apply?step=details')"));
  }
});

test('Fleet commands use confirmed identity, no browser role escalation and retained offboarding history',()=>{
  const migration=readFileSync(new URL('../supabase/migrations/081_fleet_driver_onboarding.sql',import.meta.url),'utf8');
  assert.match(migration,/u.email_confirmed_at is not null/);
  assert.match(migration,/fleet_invitation_joinable\(actor_user_id,org\)/);
  assert.match(migration,/email<>confirmed_email/);
  assert.match(migration,/set active=false,offboarded_at=now\(\)/);
  assert.doesNotMatch(migration,/delete from (public\.)?(drivers|profiles|driver_vehicle_assignments|provider_shipments)/);
  assert.match(migration,/revoke insert,update,delete on public.drivers/);
});

test('Membership hardening changes only its two scoped Fleet functions',()=>{
  const migration=readFileSync(new URL('../supabase/migrations/082_fleet_assignment_membership.sql',import.meta.url),'utf8');
  assert.equal((migration.match(/create or replace function/g)||[]).length,2);
  assert.equal((migration.match(/member.organization_id=driver.organization_id/g)||[]).length,2);
  assert.match(migration,/Recheck membership after waiting/);
  assert.doesNotMatch(migration,/workspace_dashboard/);
});
