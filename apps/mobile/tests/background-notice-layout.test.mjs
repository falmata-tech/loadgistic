import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Global notices sit outside route headers. A page's SafeAreaView cannot protect
// their hit targets; check the notice itself and retain installed-device acceptance.
function unprotectedActions(source) {
 const file=ts.createSourceFile('notice.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const safeViews=new Set(),issues=[];
 for(const statement of file.statements){
  if(!ts.isImportDeclaration(statement)||statement.moduleSpecifier.text!=='react-native-safe-area-context')continue;
  const names=statement.importClause?.namedBindings;
  if(names&&ts.isNamedImports(names))for(const element of names.elements){
   if((element.propertyName?.text||element.name.text)==='SafeAreaView')safeViews.add(element.name.text);
  }
 }
 const visit=node=>{
  const opening=ts.isJsxElement(node)?node.openingElement:ts.isJsxSelfClosingElement(node)?node:null;
  if(opening?.tagName.getText(file)==='Pressable'&&opening.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(file)==='onPress')){
   let parent=node.parent,protectedAction=false;
   while(parent){
    if(ts.isJsxElement(parent)&&safeViews.has(parent.openingElement.tagName.getText(file))){
     const edges=parent.openingElement.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(file)==='edges');
     const expression=edges?.initializer&&ts.isJsxExpression(edges.initializer)?edges.initializer.expression:null;
     // SafeAreaView defaults to all edges; a bottom-only inset does not fix NR-26.
     if(!edges||(expression&&ts.isArrayLiteralExpression(expression)&&expression.elements.some(e=>ts.isStringLiteral(e)&&e.text==='top'))){protectedAction=true;break;}
    }
    parent=parent.parent;
   }
   if(!protectedAction)issues.push(file.getLineAndCharacterOfPosition(node.getStart(file)).line+1);
  }
  ts.forEachChild(node,visit);
 };
 visit(file);return issues;
}

test('a global permission action requires its own native safe-area protection',()=>{
 const importSafe="import {SafeAreaView} from 'react-native-safe-area-context';";
 assert.equal(unprotectedActions('<View><Pressable onPress={request}/></View>').length,1);
 assert.equal(unprotectedActions(importSafe+'<><SafeAreaView><Text>Header</Text></SafeAreaView><Pressable onPress={request}/></>').length,1);
 assert.equal(unprotectedActions("import {SafeAreaView} from 'react-native';<SafeAreaView><Pressable onPress={request}/></SafeAreaView>").length,1);
 assert.equal(unprotectedActions(importSafe+'<SafeAreaView edges={["bottom"]}><Pressable onPress={request}/></SafeAreaView>').length,1);
 assert.deepEqual(unprotectedActions(importSafe+'<SafeAreaView><Pressable onPress={request}/></SafeAreaView>'),[]);
 assert.deepEqual(unprotectedActions(importSafe+'<SafeAreaView edges={["top","left","right"]}><Pressable onPress={request}/></SafeAreaView>'),[]);
});

test('the actual global shipment-location notice stays outside system hit targets',()=>{
 const source=readFileSync(new URL('../src/components/background-tracking.tsx',import.meta.url),'utf8');
 assert.deepEqual(unprotectedActions(source),[],'The global location action must be protected independently of route headers (NR-26).');
});
