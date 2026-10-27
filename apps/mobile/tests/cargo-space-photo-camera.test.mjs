import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const vehicleId='aa3b1729-2761-4ff8-9988-2bb7a46741e1';
const actorId='1c3a2187-8a94-4ed4-b13c-a41eb4b9be9b';
const source=readFileSync(new URL('../src/components/cargo-space-photo.tsx',import.meta.url),'utf8');
const parsed=ts.createSourceFile('cargo-space-photo.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const withoutImports=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))));
const code=ts.transpileModule(withoutImports,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;

function cameraScreen(platform,granted=true){
 const stores=new Map(),calls=[];let slots=[],cursor=0;
 const React={createElement:(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity)}})};
 const hooks={
  useState:initial=>{const state=slots,index=cursor++;if(!(index in state))state[index]=typeof initial==='function'?initial():initial;return[state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},
  useRef:initial=>{const index=cursor++;return slots[index]||(slots[index]={current:initial});},
  useCallback:callback=>callback,useEffect(){},
 };
 const ImagePicker={
  requestCameraPermissionsAsync:async()=>{calls.push('permission');return{granted};},
  launchCameraAsync:async()=>{calls.push('camera');return{canceled:true};},
  launchImageLibraryAsync:async()=>{calls.push('gallery');return{canceled:true};},
 };
 const account={session:{user:{id:actorId}},request:async()=>{throw Error('Unexpected API request');}};
 const hosts=Object.fromEntries(['AppState','Image','Modal','SafeAreaView','View','Button','Copy','ErrorText','LoadingSpinner','Page','Title','WorkspaceSection'].map(name=>[name,name]));
 const args={React,...hooks,...hosts,AppState:{currentState:'active'},Platform:{OS:platform},ImagePicker,
  useFocusEffect:callback=>callback(),useAccount:()=>account,useAccountQuery:()=>({data:{photo:null,requests:[]},loading:false,error:'',reload:async()=>{}}),
  useLanguage:()=>({t:value=>value,locale:'en'}),blockChatReading(){},cargoPhotoCollectionPath:()=>'/photo',
  cargoPhotoReadPath:value=>value,cargoPhotoUploadCommand(){},uploadBody(){},uploadLimit:4*1024*1024,palette:{border:'#abc'},
 };
 const exports={};new Function(...Object.keys(args),'exports',code)(...Object.values(args),exports);
 function resolve(node,path='root'){
  if(Array.isArray(node))return node.map((child,index)=>resolve(child,`${path}/${index}`));
  if(!node||typeof node!=='object')return node;
  if(typeof node.type==='function'){
   const key=`${path}:${node.type.name}`;slots=stores.get(key)||[];stores.set(key,slots);cursor=0;
   return resolve(node.type(node.props),`${key}/content`);
  }
  return{...node,props:{...node.props,children:resolve(node.props.children,`${path}/children`)}};
 }
 const render=()=>resolve(React.createElement(exports.CargoSpacePhoto,{vehicleId,assignedDriverId:actorId}));
 const find=(node,type,match=()=>true)=>{
  if(Array.isArray(node))return node.map(child=>find(child,type,match)).find(Boolean);
  if(!node||typeof node!=='object')return null;
  return node.type===type&&match(node)?node:find(node.props?.children,type,match);
 };
 return{render,find,calls};
}

test('Expo web camera opens from the Take photo press without waiting for permission',async()=>{
 const view=cameraScreen('web'),tree=view.render();
 view.find(tree,'Button',node=>node.props.message==='Take photo').props.onPress();
 assert.deepEqual(view.calls,['camera'],'web picker must open in the same user-action stack');
});

test('native camera asks permission and never opens after denial',async()=>{
 const allowed=cameraScreen('android');
 allowed.find(allowed.render(),'Button',node=>node.props.message==='Take photo').props.onPress();
 assert.deepEqual(allowed.calls,['permission']);
 await Promise.resolve();await Promise.resolve();
 assert.deepEqual(allowed.calls,['permission','camera']);

 const denied=cameraScreen('android',false);
 denied.find(denied.render(),'Button',node=>node.props.message==='Take photo').props.onPress();
 await Promise.resolve();await Promise.resolve();
 assert.deepEqual(denied.calls,['permission']);
 assert.ok(denied.find(denied.render(),'ErrorText',node=>node.props.message==='Allow camera access to take a photo.'));
});
