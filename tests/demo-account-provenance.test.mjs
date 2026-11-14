import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {capacityLoadPreference,capacityLoadLabel} from '../src/lib/capacity-load-preferences.js';
import {localizedUpdateLabel} from '../src/lib/i18n/update-label.js';

const t=(message,values={})=>message.replace(/\{([^}]+)\}/g,(_,key)=>String(values[key]??''));
const dependencies={
 'react/jsx-runtime':jsxRuntime,'next/link':{__esModule:true,default:'a'},
 'lucide-react':{Building2:()=>null,CalendarClock:()=>null,MapPinned:()=>null,Phone:()=>null},
 './localization':{Text:({message,values})=>t(message,values),useTranslation:()=>({t})},
 '@/lib/capacity-sharing':{capacitySharingLabel:()=>''},'@/lib/i18n/update-label.js':{localizedUpdateLabel},
 '@/lib/capacity-load-preferences':{capacityLoadPreference,capacityLoadLabel},
 './truck-document-summary':{TruckDocumentSummary:()=>null},
 '@/lib/vehicle-configurations':{vehicleConfigurationImage:()=>'/vehicle-configurations/cargo-van.jpg'},
 './public-truck-presentation.module.css':{__esModule:true,default:{summary:'summary'}},
 './public-identity-image':{PublicIdentityImage:()=>null},
 './public-identity-image.module.css':{__esModule:true,default:{mapPerson:'person'}},
 './truck-authority':{TruckAuthorityBadges:()=>null},'./cargo-space-photo-panel':{BusinessCargoSpacePhoto:()=>null}
};
const compiled=ts.transpileModule(readFileSync('src/components/map-truck-details.tsx','utf8'),{
 compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText;
const exported={};
new Function('require','exports',compiled)(name=>{
 assert.ok(Object.hasOwn(dependencies,name),'Unexpected component dependency '+name);return dependencies[name];
},exported);
const base={provider_name:'Public provider',provider_handle:'public-provider',status:'EMPTY',assigned_driver_first_name:'Assigned',capacity_updated_label:'Updated today',location_updated_label:'Location updated today'};

test('web details display trusted Demo account separately from a saved synthetic location',()=>{
 const html=renderToStaticMarkup(jsxRuntime.jsx(exported.MapTruckDetails,{truck:{...base,account_is_demo:true,location_is_demo:false}}));
 assert.match(html,/Demo account/);assert.match(html,/Public provider/);assert.match(html,/Assigned/);
 for(const account_is_demo of [false,undefined,null,'true',1]){
  const normal=renderToStaticMarkup(jsxRuntime.jsx(exported.MapTruckDetails,{truck:{...base,account_is_demo,location_is_demo:true,user_metadata:{is_demo:true}}}));
  assert.doesNotMatch(normal,/Demo account/);
 }
});
