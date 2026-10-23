import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const element=(type,props)=>({type,props:props||{}});
const ports={
 'react/jsx-runtime':{jsx:element,jsxs:element},
 '@/components/date-picker':{DatePicker:'DatePicker'},
 '@/components/localization':{Text:'Text',Localized:'Localized'},
 './ethiopia-place-input':{EthiopiaPlaceInput:'EthiopiaPlaceInput'},'./workspace-task-dialog':{WorkspaceTaskDialog:'TaskDialog'},'lucide-react':{ArrowLeftRight:'ArrowLeftRight',Pencil:'Pencil',XCircle:'XCircle'},'./tracking-record.module.css':{default:{actions:'actions'}}
};
const exports={};
const source=readFileSync(new URL('../src/components/lifecycle-controls.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
new Function('require','exports',code)(name=>{assert.ok(name in ports,'Unexpected component dependency');return ports[name];},exports);
const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
const context={id:'shipment',revision:'2026-10-14T12:00:00Z',status:'TO_PICKUP',cargo_summary:'Grain',origin:'Adama',destination:'Dire Dawa',origin_place_ref:'origin',destination_place_ref:'destination',passing:'Awash',passing_place_ref:'passing',vehicles:[],assigned_vehicle_number:'LG-001'};
const forms=actions=>nodes(exports.TrackingRecoveryControls({context:{...context,actions}})).filter(node=>node.type==='form');
const commands=actions=>forms(actions).map(form=>nodes(form).find(node=>node.type==='input'&&node.props.name==='action').props.value);

test('Independent and agreed-tracking providers see correction without unavailable truck changes or cancellation',()=>{
 assert.deepEqual(commands(['CORRECT']),['CORRECT']);
});
test('fleet providers retain permitted correction and reassignment without staff-only cancellation',()=>{
 assert.deepEqual(commands(['CORRECT','REASSIGN']),['CORRECT','REASSIGN']);
});
test('Operations retains all three allowed recovery forms with saved revision and reason',()=>{
 assert.deepEqual(commands(['CORRECT','REASSIGN','CANCEL']),['CORRECT','REASSIGN','CANCEL']);
 for(const form of forms(['CORRECT','REASSIGN','CANCEL'])){
  const fields=nodes(form);
  assert.equal(form.props.action,'/api/provider-shipments/shipment/recovery');
  assert.ok(fields.some(node=>node.type==='input'&&node.props.name==='revision'&&node.props.value===context.revision));
  assert.ok(fields.some(node=>node.type==='textarea'&&node.props.name==='reason'&&node.props.required));
 }
});
test('empty or absent contexts and unsupported actions cannot create a recovery form',()=>{
 assert.equal(exports.TrackingRecoveryControls({context:null}),null);
 assert.equal(exports.TrackingRecoveryControls({context:{...context,actions:[]}}),null);
 assert.deepEqual(commands(['UNSUPPORTED']),[]);
});
test('each allowed action can appear independently and cancellation retains explicit confirmation',()=>{
 assert.deepEqual(commands(['REASSIGN']),['REASSIGN']);
 assert.deepEqual(commands(['CANCEL']),['CANCEL']);
 assert.ok(nodes(forms(['CANCEL'])[0]).some(node=>node.type==='input'&&node.props.name==='confirm'&&node.props.value==='CANCEL'&&node.props.required));
});

test('admin recovery keeps account return outside the business command fields',()=>{
 const returnTo='/admin/operations/tracking/shipment?returnTo=account';
 const tree=exports.TrackingRecoveryControls({context:{...context,actions:['CORRECT','REASSIGN','CANCEL']},returnTo});
 for(const form of nodes(tree).filter(node=>node.type==='form'))assert.ok(nodes(form).some(node=>node.type==='input'&&node.props.name==='returnTo'&&node.props.value===returnTo));
});
