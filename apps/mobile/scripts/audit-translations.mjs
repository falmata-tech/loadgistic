import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {nativeMessages} from '../src/localization/messages.ts';

// Counts explicit copy boundaries only. Dynamic labels, server errors and raw
// Text nodes still need manual coverage review; this is not a fluency check.
const root=fileURLToPath(new URL('../src/',import.meta.url));
const files=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):entry.name.endsWith('.tsx')?[path.join(directory,entry.name)]:[]);
const messages=new Map();
function add(value,file,node){
 const key=value.trim();if(!key||key==='Loadgistic')return;
 const locations=messages.get(key)||new Set();locations.add(`${path.relative(root,file.fileName)}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line+1}`);messages.set(key,locations);
}
for(const name of files(root)){
 const file=ts.createSourceFile(name,fs.readFileSync(name,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const visit=node=>{
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='t'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))add(node.arguments[0].text,file,node);
  if((ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node))&&['Title','Copy','Field','Button','AppLink','ActionLink'].includes(node.tagName.getText(file)))for(const attr of node.attributes.properties){
   if(ts.isJsxAttribute(attr)&&attr.name.getText(file)==='message'){
    const value=attr.initializer;
    if(value&&ts.isStringLiteral(value))add(value.text,file,attr);
    else if(value&&ts.isJsxExpression(value)&&value.expression&&ts.isStringLiteral(value.expression))add(value.expression.text,file,attr);
   }
  }
  ts.forEachChild(node,visit);
 };visit(file);
}
const locales=['am','om','so','ti'];
const catalogs=Object.fromEntries(locales.map(locale=>[locale,{...JSON.parse(fs.readFileSync(new URL(`../../../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8')),...nativeMessages[locale]}]));
const missing=[...messages].flatMap(([message,locations])=>{
 const absent=locales.filter(locale=>typeof catalogs[locale][message]!=='string'||!catalogs[locale][message].trim());
 return absent.length?[{message,locales:absent,locations:[...locations]}]:[];
}).sort((a,b)=>a.message.localeCompare(b.message));
const report={boundary:'Explicit fixed messages only; manual dynamic/remaining raw text and fluency review required',messages:messages.size,fullyCovered:messages.size-missing.length,missing:missing.length,items:missing};
console.log(process.argv.includes('--json')?JSON.stringify(report,null,2):`${report.fullyCovered}/${report.messages} explicit native messages have all four translations; ${report.missing} remain. Use --json for locations. Dynamic/raw text still needs manual review.`);
if(process.argv.includes('--strict')&&missing.length)process.exitCode=1;
