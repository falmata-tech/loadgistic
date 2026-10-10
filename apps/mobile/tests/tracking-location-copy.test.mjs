import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function displayedMessages(source){
 const file=ts.createSourceFile('shipment.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),messages=[];
 const visit=node=>{
  if(ts.isJsxAttribute(node)&&node.name.getText(file)==='message'){
   const value=node.initializer;
   if(value&&ts.isStringLiteral(value))messages.push(value.text);
   else if(value&&ts.isJsxExpression(value)&&value.expression&&ts.isStringLiteral(value.expression))messages.push(value.expression.text);
  }
  ts.forEachChild(node,visit);
 };visit(file);return messages;
}
const contradictsBackground=text=>/updates pause when you leave|updates pause.*lock your phone/i.test(text);
test('shipment privacy instructions do not contradict consented background reporting',()=>{
 assert.ok(displayedMessages('<Copy message={"Updates pause when you leave this screen or lock your phone."}/>').some(contradictsBackground),'Original privacy failure must be detected');
 const messages=displayedMessages(readFileSync(new URL('../src/screens/shipment-detail.tsx',import.meta.url),'utf8'));
 assert.ok(!messages.some(contradictsBackground),'An agreed native shipment continues independently of the open screen (NR-27)');
 const explanation='The assigned driver shares an approximate location until unloading is approved. This choice stays with the shipment.';
 assert.ok(messages.includes(explanation));
 for(const locale of ['am','om','so','ti']){
  const catalog=JSON.parse(readFileSync(new URL(`../../../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8'));
  assert.ok(catalog[explanation]?.trim()&&catalog[explanation]!==explanation,'Existing native explanation must stay translated: '+locale);
 }
});
