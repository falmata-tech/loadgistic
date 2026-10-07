import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceFormReturnPath as target} from '../src/lib/workspace-form-navigation.js';
test('contextual forms retain only known account and fleet destinations',()=>{
 for(const path of ['/app/more#business','/app/more#documents','/app/company-page#documents','/app/fleet','/app/fleet/abcdef12-1234-1234-1234-abcdef123456'])assert.equal(target(path),path);
 assert.equal(target('/app/fleet?driverPage=2&redirect=https://evil.test#driver-access'),'/app/fleet?driverPage=2#driver-access');
 for(const path of ['//evil.test/app/fleet','https://evil.test','/app/admin','/app/more?redirect=evil','/app/more#unknown','/app/\\evil','/app/fleet\n','',null])assert.equal(target(path),'/app/verification');
 assert.equal(target('/unknown','/app/company-page'),'/app/company-page');
});
