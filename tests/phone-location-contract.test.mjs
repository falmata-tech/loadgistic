import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {phoneInstallationProof} from '../src/lib/phone-location-contract.js';
import {phoneLocationCommand} from '../src/lib/phone-location-command.js';
import {gpsMessages} from '../src/lib/i18n/gps-messages.ts';
const id='11111111-1111-4111-8111-111111111111',proof={installationId:id,bindingId:id,revision:id,reportId:id,secret:'a'.repeat(64),observedAt:1800000000000};
test('private phone proof rejects spoofed fields and emits only a digest to persistence',()=>{
 assert.equal(phoneInstallationProof.safeParse(proof).success,true);
 for(const extra of [{hardwareImei:'123'},{actorId:id},{engineOn:true},{secret:'short'},{observedAt:Infinity},{bindingId:'bad'}])assert.equal(phoneInstallationProof.safeParse({...proof,...extra}).success,false);
 const command=phoneLocationCommand(proof);assert.equal(command.observed_at,new Date(proof.observedAt).toISOString());assert.equal(command.report_id,id);
 assert.match(command.secret_digest,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(command).includes(proof.secret),false);
 assert.equal(phoneLocationCommand(undefined),undefined);
});
test('phone installation SQL fences private tables, current assignment/source and observed order',()=>{
 const sql=readFileSync('supabase/migrations/157_phone_location_installations.sql','utf8');
 for(const name of ['phone_location_installations','phone_location_bindings','phone_location_report_receipts'])assert.ok(sql.includes("'"+name+"'"));
 for(const marker of ['note_real_location_device_use(actor_user_id,vehicle,target_installation_id)','PHONE_LOCATION_SUPERSEDED','PHONE_LOCATION_IN_USE','phone_location_binding_is_current','auth.sessions','s.not_after','binding.last_observed_at','phone_location_report_receipts','ASSIGNMENT_CHANGED','ACCOUNT_CHANGED','for update','phone_binding_revision'])assert.ok(sql.includes(marker),marker);
 assert.match(sql,/revoke all on function %s from public,anon,authenticated,service_role/);
 assert.doesNotMatch(sql.replace(/^--.*$/gm,''),/grant .* (?:anon|authenticated)|hardware.?imei|push_token|ENGINE_CUT|ignition/i);
 const report=sql.slice(sql.indexOf('create function public.report_tracking_device_location'));
 assert.ok(report.indexOf('perform 1 from vehicles')<report.indexOf('result:=report_tracking_device_location_pre_phone157'));
});

test('private phone registration and logout-retry errors have native-language recovery guidance',()=>{
 const messages=['Another phone is connected to this vehicle. Disconnect it before connecting this phone.','This phone is no longer connected to this vehicle. Sign in again and check its location source.','Sign in again to connect this phone.','Could not confirm this phone. Please try again.','Phone details could not be confirmed.','Phone location could not connect. Please try again.','Phone location could not be confirmed.','Reconnect to finish disconnecting the previous phone session.','Sign in before sharing this phone’s location.','Location sharing paused. Please try again.'];for(const locale of ['am','om'])for(const message of messages)assert.ok(gpsMessages[locale][message]&&gpsMessages[locale][message]!==message,`${locale}: ${message}`);
});
