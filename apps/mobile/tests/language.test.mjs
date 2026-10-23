import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {createLanguageController,localeCode,languages} from '../src/localization/controller.ts';
import {translateMessage} from '../../../src/lib/i18n/core.js';
import {nativeMessages} from '../src/localization/messages.ts';
test('language choice supersedes late restore and failed storage keeps the usable language',async()=>{
 let resolve;let fail=false;const pending=new Promise(r=>resolve=r),saved=[];
 const c=createLanguageController({read:()=>pending,load:async locale=>({About:locale}),write:async locale=>{if(fail)throw Error('storage');saved.push(locale);},changed:()=>{}});
 const restoring=c.restore();await c.select('am');resolve('so');await restoring;
 assert.equal(c.snapshot().locale,'am');assert.deepEqual(saved,['am']);
 fail=true;await c.select('om');assert.equal(c.snapshot().locale,'am');assert.ok(c.snapshot().error);
 assert.equal(localeCode('invalid'),'en');
 assert.equal(localeCode('so'),'en');
 assert.equal(localeCode('ti'),'en');
 assert.deepEqual(languages.map(item=>item.code),['en','am','om']);
});
test('native navigation additions have matching nonempty keys in both supported catalogs',()=>{
 const expected=Object.keys(nativeMessages.am).sort();
 for(const locale of ['am','om']) {
  assert.deepEqual(Object.keys(nativeMessages[locale]).sort(),expected);
  assert.ok(Object.values(nativeMessages[locale]).every(value=>value.trim()));
 }
});
test('generic UI translations are explicitly marked literals, never user-record expressions',()=>{
 const root=fileURLToPath(new URL('../src/',import.meta.url));
 const files=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):entry.name.endsWith('.tsx')?[path.join(directory,entry.name)]:[]);
 const fixedCopy=expression=>ts.isStringLiteral(expression)||ts.isParenthesizedExpression(expression)&&fixedCopy(expression.expression)||ts.isConditionalExpression(expression)&&fixedCopy(expression.whenTrue)&&fixedCopy(expression.whenFalse);
 for(const name of files(root)){
  const file=ts.createSourceFile(name,readFileSync(name,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const visit=node=>{
   if((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&['Copy','Title','Button','Field','AppLink','ActionLink'].includes(node.tagName.getText(file))) {
    for(const attr of node.attributes.properties)if(ts.isJsxAttribute(attr)&&attr.name.getText(file)==='message'){
     const value=attr.initializer;
     assert.ok(value&&(ts.isStringLiteral(value)||(ts.isJsxExpression(value)&&value.expression&&fixedCopy(value.expression))),`${name}: translation input must be fixed app copy`);
    }
   }
   ts.forEachChild(node,visit);
  };visit(file);
 }
});
test('visible fixed JSX copy does not bypass localization',()=>{
 const root=fileURLToPath(new URL('../src/',import.meta.url));
 const files=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):entry.name.endsWith('.tsx')?[path.join(directory,entry.name)]:[]);
 for(const name of files(root)){
  const file=ts.createSourceFile(name,readFileSync(name,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const visit=node=>{
   if(ts.isJsxText(node)){
    const copy=node.getText(file).trim();
    if(/[A-Za-z]{3}/.test(copy))assert.match(copy,/^EAT(?: ·)?$/,`${name}: fixed JSX text bypasses translation`);
   }
   ts.forEachChild(node,visit);
  };visit(file);
 }
});
test('public and role-aware navigation have copy in every supported language',async()=>{
 const {publicDestinations,workspaceDestinations}=await import('../src/navigation/destinations.ts');
 const keys=new Set(['Marketplace','My workspace','Switch view','Account details','Your driver photo','Email and account security','Transporter profile','Regular service','Documents','On-duty Vehicles','Active Tracking','Published Reviews','Completed Tracking','Recent tracking','Back','Dashboard','Language','Open menu','Close menu','Menu','Your workspace','Explore','Finish account setup','Sign out','Sign-out could not finish. Please try again.','Your driving workspace','Your transport workspace','Close vehicle details','Close transporter results','Transporters','Partial capacity']);
 for(const role of ['TRANSPORTER','DRIVER'])for(const operatingModel of ['COMPANY_DRIVER','OWNER_OPERATOR','SELF_MANAGED_DRIVER'])for(const granted of [true,false]){
  const session={state:'ACTIVE',user:{role,operatingModel},access:{granted}};
  for(const item of [...publicDestinations,...workspaceDestinations(session)])keys.add(item.label);
 }
 for(const locale of ['am','om']){const messages={...JSON.parse(readFileSync(new URL(`../../../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8')),...nativeMessages[locale]};for(const key of keys)assert.ok(messages[key]?.trim(),`${locale}: ${key}`);}
});
test('About uses existing nonempty catalog messages in every supported language',()=>{
 const source=readFileSync(new URL('../src/screens/about.tsx',import.meta.url),'utf8');
 const keys=[...source.matchAll(/\bt\('([^']+)'\)/g)].map(match=>match[1]);
 keys.push(...[...source.matchAll(/\['([^']+)','([^']+)'\]/g)].flatMap(match=>[match[1],match[2]]));
 keys.push("Capacity sharing and professional shipment tracking for Ethiopia's transporters and the businesses they serve.");
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(new URL(`../../../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8'));
  for(const key of keys)assert.ok(messages[key]?.trim(),`${locale}: ${key}`);
 }
 assert.equal(translateMessage({Hello:'ሰላም'},'Missing label'),'Missing label');
 assert.equal(translateMessage({'Hello {name}':'ሰላም {name}'},'Hello {name}',{name:'Unchanged user name'}),'ሰላም Unchanged user name');
});
test('Support copy and topics are translated with intact interpolation fields',async()=>{
 const {supportTopics}=await import('../src/api/support.ts');
 const keys=new Set(supportTopics.map(item=>item.label));
 for(const file of ['screens/support','screens/support-chat','components/private-file']){
  const source=readFileSync(new URL(`../src/${file}.tsx`,import.meta.url),'utf8');
  for(const match of source.matchAll(/\bt\('([^']+)'\)/g))keys.add(match[1]);
  for(const match of source.matchAll(/\bt\('([^']+)',/g))keys.add(match[1]);
  for(const match of source.matchAll(/message=(?:\{)?"([^"]+)"/g))keys.add(match[1]);
 }
 const fields=value=>[...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(match=>match[1]).sort();
 for(const locale of ['am','om']){
  const shared=JSON.parse(readFileSync(new URL(`../../../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8'));
  const messages={...shared,...nativeMessages[locale]};
  for(const key of keys){assert.ok(messages[key]?.trim(),`${locale}: ${key}`);assert.deepEqual(fields(messages[key]),fields(key),`${locale}: ${key}`);}
  const name='Native Test Support';
  assert.ok(translateMessage(messages,'{agent} is helping',{agent:name}).includes(name));
 }
});

test('workflow copy preserves record values and confirmation/date placeholders in every locale',async()=>{
 const {workflowRows}=await import('../src/localization/workflow-messages.ts');
 const fields=value=>[...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(match=>match[1]).sort();
 assert.equal(new Set(workflowRows.map(row=>row[0])).size,workflowRows.length);
 for(const row of workflowRows){assert.equal(row.length,3);for(const text of row.slice(1)){assert.ok(text.trim());assert.deepEqual(fields(text),fields(row[0]));}}
 for(const locale of ['am','om']){
  const messages=nativeMessages[locale],email='unchanged-person@example.test';
  assert.ok(translateMessage(messages,'Enter the code sent to {email}.',{email}).includes(email));
  assert.ok(messages['Type DEACTIVATE to confirm'].includes('DEACTIVATE'));
  assert.ok(messages['Permission valid until (YYYY-MM-DD)'].includes('YYYY-MM-DD'));
 }
});

// Current provider, capacity-sharing and Tracking copy stays in the shared offline catalogs.
test('current provider and Tracking app copy has every local-language message',()=>{
 const keys=['Transport Provider','Fleet','Add vehicle','Go live','Private network','Public + private network','How do you use this vehicle?','I own this vehicle','I am buying this vehicle through financing','I rent it or have permission to use it','Share tracking','Document review is shown separately.'];
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(new URL(`../../../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8'));
  for(const key of keys)assert.ok(messages[key]?.trim()&&messages[key]!==key,`${locale}: ${key}`);
 }
});
