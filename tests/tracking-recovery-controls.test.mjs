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
const context={id:'shipment',revision:'2026-10-14T12:00:00Z',status:'TO_PICKUP',cargo_summary:'Grain',origin:'Adama',destination:'Dire Dawa',origin_place_ref:'origin',destination_place_ref:'destination',passing:'Awash',passing_place_ref:'passing',expected_pickup_date:'2026-10-20',expected_delivery_date:'2026-10-24',assigned_vehicle_id:'current',assigned_vehicle_number:'LG-001',vehicles:[{id:'current',platform_number:'LG-001'},{id:'replacement',platform_number:'LG-002'}]};
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

test('reassignment is hidden when the current vehicle is the only eligible choice',()=>{
 const noReplacement={...context,vehicles:[context.vehicles[0]],actions:['CORRECT','REASSIGN']};
 const tree=exports.TrackingRecoveryControls({context:noReplacement});
 assert.deepEqual(nodes(tree).filter(node=>node.type==='form').map(form=>nodes(form).find(node=>node.type==='input'&&node.props.name==='action')?.props.value),['CORRECT']);
 assert.equal(nodes(tree).some(node=>node.type==='TaskDialog'&&node.props.triggerLabel==='Change vehicle'),false);
});

test('reassignment requires an explicit different vehicle and the same revision/reason',()=>{
 const tree=exports.TrackingRecoveryControls({context:{...context,actions:['REASSIGN']}});
 const form=nodes(tree).find(node=>node.type==='form');
 const inputs=nodes(form);
 assert.equal(inputs.find(node=>node.type==='input'&&node.props.name==='vehicle_id')?.props.defaultValue,undefined);
 assert.ok(inputs.some(node=>node.type==='input'&&node.props.name==='revision'&&node.props.value===context.revision));
 assert.ok(inputs.some(node=>node.type==='textarea'&&node.props.name==='reason'&&node.props.required));
 assert.deepEqual(inputs.filter(node=>node.type==='option').map(node=>node.props.value),['LG-002']);
});

test('provider correction does not offer a locked expected delivery editor after Loading',()=>{
 const tree=exports.TrackingRecoveryControls({context:{...context,status:'LOADING',actions:['CORRECT']}});
 const form=nodes(tree).find(node=>node.type==='form');
 assert.equal(nodes(form).some(node=>node.type==='DatePicker'&&node.props.name==='expected_delivery_date'),false);
 assert.ok(nodes(form).some(node=>node.type==='input'&&node.props.name==='expected_delivery_date'&&node.props.value==='2026-10-24'));
});
test('Operations retains the server-authorized later delivery-date editor',()=>{
 const tree=exports.TrackingRecoveryControls({context:{...context,status:'LOADING',actions:['CORRECT']},allowOperationsDateEdit:true});
 const form=nodes(tree).find(node=>node.type==='form');
 assert.ok(nodes(form).some(node=>node.type==='DatePicker'&&node.props.name==='expected_delivery_date'));
 assert.equal(nodes(form).some(node=>node.type==='input'&&node.props.name==='expected_delivery_date'),false);
});
