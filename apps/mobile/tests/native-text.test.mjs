import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync,readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
// A web-valid raw space between buttons crashes/warns in a native View. This
// catches the Android-discovered regression across native container components.
const containers=new Set(['View','Animated.View','SafeAreaView','ScrollView','Pressable','Page','Card']);
function violations(source,name){
 const file=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),issues=[];
 const visit=node=>{
  let host=node;
  if(ts.isJsxFragment(node)){
   host=node.parent;
   while(host&&!ts.isJsxElement(host))host=host.parent;
  }
  if((ts.isJsxElement(node)||ts.isJsxFragment(node))&&host&&ts.isJsxElement(host)&&containers.has(host.openingElement.tagName.getText(file)))for(const child of node.children){
   if(ts.isJsxText(child)&&child.text&&(child.text.trim()||!/[\r\n]/.test(child.text)))issues.push(`${name}:${file.getLineAndCharacterOfPosition(child.getStart(file)).line+1}`);
   if(ts.isJsxExpression(child)&&child.expression&&(ts.isStringLiteral(child.expression)||ts.isNumericLiteral(child.expression)))issues.push(`${name}:${file.getLineAndCharacterOfPosition(child.getStart(file)).line+1}`);
  }
  ts.forEachChild(node,visit);
 };visit(file);return issues;
}
test('raw text/inline whitespace cannot be placed directly inside native containers',()=>{
 assert.equal(violations('<View><Button/> <Button/></View>','fixture.tsx').length,1);
 assert.equal(violations('<View>{ready&&<><Button/> <Button/></>}</View>','fixture.tsx').length,1);
 assert.equal(violations('<Text>{ready&&<>Hello <Text>name</Text></>}</Text>','fixture.tsx').length,0);
 assert.equal(violations('<View><Text>Hello</Text>\n <Button/></View>','fixture.tsx').length,0);
 const root=fileURLToPath(new URL('../src/',import.meta.url));
 const files=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):entry.name.endsWith('.tsx')?[path.join(directory,entry.name)]:[]);
 assert.deepEqual(files(root).flatMap(file=>violations(readFileSync(file,'utf8'),path.relative(root,file))),[]);
});
