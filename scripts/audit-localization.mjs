import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
// A static coverage inventory, not proof of natural wording or dynamic-copy coverage.
const languages=['am','om','so','ti'];
const catalogs=Object.fromEntries(languages.map(language=>[language,JSON.parse(readFileSync(`src/lib/i18n/messages/${language}.json`,'utf8'))]));
const messages=new Map(),unmarked=[],dynamic=[];
function record(message,file,node,source){
 const key=message.trim();if(!key)return;
 const location=`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line+1}`;
 if(!messages.has(key))messages.set(key,[]);messages.get(key).push(location);
}
function walk(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){
 const file=path.join(directory,entry.name);if(entry.isDirectory()){walk(file);continue;}if(!/\.tsx?$/.test(file))continue;
 const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function visit(node){
  if(ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node)){
   const tag=node.tagName.getText(source),attributes=node.attributes.properties.filter(ts.isJsxAttribute);
   for(const attribute of attributes){
    const name=attribute.name.getText(source);
    if(attribute.initializer&&ts.isJsxExpression(attribute.initializer)&&((tag==='Text'&&name==='message')||['placeholder','title','aria-label','alt'].includes(name))){
     dynamic.push({file,line:source.getLineAndCharacterOfPosition(attribute.getStart(source)).line+1,kind:tag==='Text'?'dynamic-message':'dynamic-attribute',expression:attribute.initializer.getText(source)});
    }
    if(!attribute.initializer||!ts.isStringLiteral(attribute.initializer))continue;
    if(tag==='Text'&&name==='message'||tag==='Localized'&&['placeholder','title','aria-label','alt'].includes(name))record(attribute.initializer.text,file,attribute,source);
   }
  }
  // Explicit application-owned object labels (never arbitrary data/name fields).
  if(ts.isPropertyAssignment(node)&&['label','hint','placeholder','emptyLabel'].includes(node.name.getText(source))&&ts.isStringLiteral(node.initializer))record(node.initializer.text,file,node,source);
  if(ts.isJsxExpression(node)&&!ts.isJsxAttribute(node.parent)&&node.expression&&ts.isTemplateExpression(node.expression))dynamic.push({file,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,kind:'interpolated-copy',expression:node.expression.getText(source)});
  if(ts.isCallExpression(node)&&node.expression.getText(source)==='t'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))record(node.arguments[0].text,file,node,source);
  if(ts.isJsxText(node)&&/[A-Za-z]{2}/.test(node.text))unmarked.push({file,line:source.getLineAndCharacterOfPosition(node.pos).line+1,text:node.text.trim()});
  ts.forEachChild(node,visit);
 }visit(source);
}}
walk('src/app');walk('src/components');
// Product names, units, literal examples and numeric notation intentionally stay unchanged.
const unchanged=new Set(['Loadgistic','Isuzu','NPR','WhatsApp','km','km.','MB.','AM','+251…','07:30–09:00 EAT','35000','10 km','25 km','50 km','100 km','200 km','name@example.com','https://example.com','https://www.tiktok.com/@loadgistic/live','LG-RV-XXXX-XXXX-XXXX-XXXX','LG-XXXX-XXXX-XXXX-XXXX']);
const missing=[...messages].filter(([key])=>!unchanged.has(key)).map(([key,locations])=>({message:key,locales:languages.filter(language=>!catalogs[language][key]),locations})).filter(entry=>entry.locales.length);
const report={status:missing.length||unmarked.length||dynamic.length?'incomplete':'static-coverage-passed',catalogEntries:Object.fromEntries(languages.map(language=>[language,Object.keys(catalogs[language]).length])),markedMessages:messages.size,missingCount:missing.length,unmarkedCount:unmarked.length,dynamicReviewCount:dynamic.length,
 limitations:['Dynamic findings require review: some contain user content that must remain unchanged. This is an inventory, not an instruction to translate arbitrary values.','Computed copy, metadata, native browser messages and outbound email still need separate review.','Catalog parity and coverage do not establish translation quality.'],missing,unmarked,dynamic};
console.log(JSON.stringify(report,null,2));if(process.argv.includes('--strict')&&(missing.length||unmarked.length||dynamic.length))process.exitCode=1;
