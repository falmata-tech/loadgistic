import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {workspaceCapabilities} from '../apps/mobile/src/navigation/destinations.ts';
import {currentDrivingTruck,fleetDriverEditorKey} from '../apps/mobile/src/navigation/current-driving-pair.ts';

function home({user,vehicles}){
 const React={createElement:(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity)}}),Fragment:'Fragment'};
 const module={};
 const compiled=ts.transpileModule(readFileSync('apps/mobile/src/screens/driver-home.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
 const ports={react:React,'react-native':{View:'View',Text:'Text',StyleSheet:{create:value=>value,absoluteFill:{}}},
  '../localization/provider':{useLanguage:()=>({t:value=>value})},'../session/provider':{useAccount:()=>({session:{state:'ACTIVE',user,access:{granted:true}}})},
  '../hooks/account-query':{useAccountQuery:()=>({data:{vehicles,canPublish:true},error:'',reload:async()=>{}})},
  '../navigation/destinations':{workspaceCapabilities},'../navigation/current-driving-pair':{currentDrivingTruck},'../components/ui':{palette:{border:'#cbd5e1',blue:'#155eef',ink:'#0b1d3a',muted:'#526375'}}};
 new Function('require','exports','React',compiled)(name=>ports[name]||{},module,React);
 return module.DriverHome();
}
function assigned(tree){if(tree?.props?.truck)return tree.props.truck;for(const child of tree?.props?.children||[]){const found=assigned(child);if(found)return found;}return undefined;}
const owner={id:'owner',role:'DRIVER',operatingModel:'SELF_MANAGED_DRIVER',ownsProviderAccount:true,canManageFleet:true,drivesTruck:true,currentDriverId:'owner',currentDrivenVehicleId:'old-truck'};
test('actual native Home follows the server current pair after owner A-to-B reassignment without Auth rotation',()=>{
 const vehicles=[{id:'old-truck',driverId:'employee'},{id:'new-truck',driverId:'owner'}];
 assert.equal(assigned(home({user:owner,vehicles}))?.id,'new-truck');
});
test('driver editor identity follows saved assignment, permissions and contact fields, not a pending local revision',()=>{
 const row={id:'driver',vehicleId:'truck-A',canManageCapacity:true,canManageTracking:false,name:'Driver',phone:'phone',email:'driver@example.test'};
 const key=fleetDriverEditorKey(row);assert.equal(fleetDriverEditorKey({...row}),key);
 for(const update of [{vehicleId:'truck-B'},{canManageCapacity:false},{canManageTracking:true},{name:'New name'},{phone:'new phone'},{email:'new@example.test'}])assert.notEqual(fleetDriverEditorKey({...row,...update}),key);
});
test('actual native Home follows an employed driver’s current authorized pair despite an older sign-in truck ID',()=>{
 const user={...owner,id:'employee',operatingModel:'COMPANY_DRIVER',ownsProviderAccount:false,canManageFleet:false,currentDriverId:'employee'};
 assert.equal(assigned(home({user,vehicles:[{id:'old-truck',driverId:'someone-else'},{id:'replacement',driverId:'employee'}]}))?.id,'replacement');
});
test('actual native Home never substitutes another driver or an ambiguous pair',()=>{
 assert.equal(assigned(home({user:owner,vehicles:[{id:'old-truck',driverId:'someone-else'}]})),undefined);
 assert.equal(assigned(home({user:owner,vehicles:[{id:'old-truck',driverId:'owner'},{id:'duplicate',driverId:'owner'}]})),undefined);
});
