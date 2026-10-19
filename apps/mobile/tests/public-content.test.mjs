import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import { externalDestination,programmeState } from '../src/api/public-content.ts';
test('telephone action sink normalizes accepted public formats and retains legitimate legacy short numbers',()=>{
 for(const [input,expected]of [['tel:+1.612.555.0100','tel:+16125550100'],['tel:+251 (911) 123-456','tel:+251911123456'],['tel:123456','tel:123456']])assert.equal(externalDestination(input),expected);
 for(const input of ['tel:.......','tel:------','tel:12345.6','tel:1234567\n','tel:+25+1911123456','tel:+251.911.123456?run=x','tel:+251.911.123456#x','tel:%2B251911123456','tel:+251911123456@example.test'])assert.equal(externalDestination(input),null);
});
test('a real public call button remains visible and sends the normalized destination to Linking',async()=>{
 const opened=[],React={createElement:(type,props,...children)=>({type,props,children}),Fragment:'Fragment'};
 const path='../src/components/public-details.tsx',parsed=ts.createSourceFile(path,readFileSync(new URL(path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const source=ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))),exports={};
 const code=ts.transpileModule(ts.createPrinter().printFile(source),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
 new Function('React','useState','Linking','externalDestination','Button','ErrorText','exports',code)(React,value=>[value,()=>{}],{openURL:async destination=>{opened.push(destination);}},externalDestination,'Button','ErrorText',exports);
 const rendered=exports.ExternalButton({label:'Call driver',url:'tel:+251.911.123456'}),button=rendered.children.find(child=>child.type==='Button');
 assert.equal(button.props.label,'Call driver');button.props.onPress();await Promise.resolve();assert.deepEqual(opened,['tel:+251911123456']);
 assert.equal(exports.ExternalButton({label:'Call driver',url:'tel:1234567?run=x'}),null);assert.deepEqual(opened,['tel:+251911123456']);
});
test('public contact actions reject executable intents, credentials and mailbox injection',()=>{
 for(const value of ['intent://x','javascript:alert(1)','https://u:p@example.test','file:///tmp/x','mailto:a@example.test?bcc=other@example.test','tel:12345;run'])assert.equal(externalDestination(value),null);
 for(const value of ['tel:+251900000000','mailto:public@example.test','https://example.test/'])assert.equal(externalDestination(value),value);
});
test('programme labels use actual interval boundaries, not availability',()=>{
 const start='2026-10-05T05:30:00Z',end='2026-10-05T06:00:00Z';assert.equal(programmeState(start,end,Date.parse(start)-1),'Upcoming');assert.equal(programmeState(start,end,Date.parse(start)),'Featured now');assert.equal(programmeState(start,end,Date.parse(end)),'Finished');assert.equal(programmeState('',end,Date.now()),'');
});
