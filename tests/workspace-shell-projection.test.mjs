import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {providerWorkspaceCapabilities} from '../src/lib/provider-workspace.js';
async function project(user){
 const jsx=(type,props)=>({type,props});
 const ports={'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/auth':{requireUser:async()=>user},'@/components/app-shell':{AppShell:'AppShell'},'next/navigation':{redirect:()=>{throw Error('REDIRECT');}},'@/lib/provider-workspace.js':{providerWorkspaceCapabilities}};
 const code=ts.transpileModule(readFileSync('src/app/app/layout.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,exports={};
 new Function('require','exports',code)(name=>{assert.ok(name in ports,name);return ports[name];},exports);
 return (await exports.default({children:'content'})).props.user;
}
test('workspace shell receives actual owner driving capabilities without private account data',async()=>{
 for(const drives_truck of[true,false]){
  const user={id:'owner',active:true,role:'TRANSPORTER',organization_id:'org',owns_provider_account:true,can_manage_fleet:true,drives_truck,email:'private@example.test',phone:'private',name:'Owner'};
  const view=await project(user);assert.equal(view.active,true);assert.equal(view.owns_provider_account,true);assert.equal(view.can_manage_fleet,true);assert.equal(view.drives_truck,drives_truck);assert.equal('email'in view,false);assert.equal('phone'in view,false);
 }
});
test('employee and inactive shells never acquire owner fleet capabilities',async()=>{
 for(const user of[{id:'employee',active:true,role:'DRIVER',driver_kind:'COMPANY',drives_truck:true},{id:'inactive',active:false,role:'TRANSPORTER',organization_id:'org',owns_provider_account:true,can_manage_fleet:true,drives_truck:true}]){
  const view=await project(user);assert.equal(view.owns_provider_account,false);assert.equal(view.can_manage_fleet,false);assert.equal(view.drives_truck,user.active);
 }
});
