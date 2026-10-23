import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
function assignment(){
 const states=[],refs=[],effects=[],dependencies=[];let si=0,ri=0,ei=0,refreshes=0;
 const react={useState(value){const i=si++;if(!(i in states))states[i]=value;return[states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useRef(value){const i=ri++;return refs[i]||(refs[i]={current:value});},useEffect(callback,deps){const i=ei++,before=dependencies[i];if(!before||deps.some((value,index)=>!Object.is(value,before[index])))effects.push(callback);dependencies[i]=deps;}};
 const element=(type,props)=>({type,props:props||{}}),ports={react:{__esModule:true,default:react,...react},'react/jsx-runtime':{jsx:element,jsxs:element},'next/navigation':{useRouter:()=>({refresh(){refreshes++;}})},'./localization':{Text:'Text',useTranslation:()=>({t:message=>message})}};
 const code=ts.transpileModule(readFileSync(new URL('../src/components/guest-support-assignment.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports',code)(key=>{assert.ok(key in ports,'Unexpected component dependency');return ports[key];},exports);
 return{render(props){si=ri=ei=0;return exports.GuestSupportAssignment(props);},hydrate(){while(effects.length)effects.shift()();},refreshes:()=>refreshes};
}
const props={id:'11111111-1111-4111-8111-111111111111',assignee:null,agents:[{user_id:'22222222-2222-4222-8222-222222222222',name:'Synthetic Support'}]};

test('retained-guest assignment cannot accept a selection before its handlers attach',()=>{
 const runtime=assignment();let tree=runtime.render(props);
 assert.equal(nodes(tree).find(node=>node.type==='select').props.disabled,true);
 assert.equal(nodes(tree).find(node=>node.type==='button').props.disabled,true);
 runtime.hydrate();tree=runtime.render(props);
 assert.equal(nodes(tree).find(node=>node.type==='select').props.disabled,false);
 assert.equal(nodes(tree).find(node=>node.type==='button').props.disabled,false);
});

test('the first enabled choice retains its observed assignment and sends the exact command',async()=>{
 const runtime=assignment();runtime.render(props);runtime.hydrate();let tree=runtime.render(props);
 nodes(tree).find(node=>node.type==='select').props.onChange({target:{value:props.agents[0].user_id}});
 tree=runtime.render({...props,assignee:'33333333-3333-4333-8333-333333333333'});
 runtime.hydrate();tree=runtime.render({...props,assignee:'33333333-3333-4333-8333-333333333333'});
 assert.equal(nodes(tree).find(node=>node.type==='select').props.value,props.agents[0].user_id);
 assert.equal(nodes(tree).find(node=>node.type==='input'&&node.props.name==='expectedAssignee').props.value,'');
 const previousFetch=globalThis.fetch,previousFormData=globalThis.FormData,calls=[];
 globalThis.FormData=class{constructor(form){this.form=form;}};
 globalThis.fetch=async(url,options)=>{calls.push({url,method:options.method,form:options.body.form});return{ok:true,json:async()=>({ok:true})};};
 try{
  const form={assignee:props.agents[0].user_id,expectedAssignee:''};
  await tree.props.onSubmit({preventDefault(){},currentTarget:form});
  assert.deepEqual(calls,[{url:`/api/admin/guest-support/${props.id}/assignment`,method:'POST',form}]);
  assert.equal(runtime.refreshes(),1);
 }finally{globalThis.fetch=previousFetch;globalThis.FormData=previousFormData;}
});
