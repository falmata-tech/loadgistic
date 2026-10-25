import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {translateMessage} from '../../../src/lib/i18n/core.js';
import {nativeMessages} from '../src/localization/messages.ts';

// Exercise the actual component at its React Native boundary. Android replaces
// the description with "busy" during loading unless an explicit name survives
// the spinner; idle children alone do not clear that native description.
const React={createElement:(type,props,...children)=>({type,props:{...props,children}})};
function buttonFor(locale){
 const catalog=locale==='en'?{}:JSON.parse(readFileSync(new URL(`../../../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8'));
 const t=message=>translateMessage({...catalog,...nativeMessages[locale]},message);
 const file=ts.createSourceFile('ui.tsx',readFileSync(new URL('../src/components/ui.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const source=ts.createPrinter().printFile(ts.factory.updateSourceFile(file,file.statements.filter(node=>!ts.isImportDeclaration(node))));
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText;
 const host={React,useLanguage:()=>({t}),StyleSheet:{create:value=>value},...Object.fromEntries(['ActivityIndicator','Pressable','ScrollView','Text','TextInput','View'].map(name=>[name,name]))};
 const exports={};new Function(...Object.keys(host),'exports',code)(...Object.values(host),exports);
 return {Button:exports.Button,t};
}

for(const locale of ['en','am','om'])test(`${locale} actions keep their name through loading, completion and retry`,()=>{
 const {Button,t}=buttonFor(locale);let calls=0;
 for(const message of ['Refresh','Sign in','Save']){
  const onPress=()=>{calls++;};
  for(const busy of [false,true,false,true,false]){
   const control=Button({message,busy,onPress});
   assert.equal(control.type,'Pressable');
   assert.equal(control.props.accessibilityRole,'button');
   assert.equal(control.props.accessibilityLabel,t(message));
   assert.ok(control.props.accessibilityLabel,'spinner-only controls still need their action name');
   assert.deepEqual(control.props.accessibilityState,{disabled:busy,busy});
   assert.equal(control.props.disabled,busy);
   if(!control.props.disabled)control.props.onPress();
  }
 }
 assert.equal(calls,9,'ready and retry actions remain usable');
 const disabled=Button({label:'A chosen account name',disabled:true,onPress(){throw Error('disabled action');}});
 assert.equal(disabled.props.accessibilityLabel,'A chosen account name','caller labels are record text, not translated keys');
 assert.equal(disabled.props.disabled,true);
 assert.deepEqual(disabled.props.accessibilityState,{disabled:true,busy:false});
});
