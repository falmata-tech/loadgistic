import test from 'node:test';
import assert from 'node:assert/strict';
import {canManageOwnDriverPortrait as allowed} from '../src/lib/driver-portrait-access.js';
test('active Drivers and driving provider owners reach their own portrait command',()=>{
 assert.equal(allowed({active:true,role:'DRIVER',driver_kind:'COMPANY'}),true);
 assert.equal(allowed({active:true,role:'TRANSPORTER',organization_id:'owned',drives_truck:true}),true);
 assert.equal(allowed({active:true,role:'TRANSPORTER',owns_provider_account:true,drives_truck:true}),true);
});
test('non-driving providers, inactive users, staff and non-owner projections cannot acquire portrait control',()=>{
 for(const actor of[null,{active:false,role:'DRIVER'},{active:true,role:'ADMIN'},{active:true,role:'SUPPORT'},{active:true,role:'TRANSPORTER',organization_id:'owned',drives_truck:false},{active:true,role:'TRANSPORTER',owns_provider_account:false,drives_truck:true}])assert.equal(allowed(actor),false);
});
