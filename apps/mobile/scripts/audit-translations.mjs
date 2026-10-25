import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {gpsMessages} from '../../../src/lib/i18n/gps-messages.ts';
import {nativeMessages} from '../src/localization/messages.ts';

// Counts explicit copy boundaries only. Dynamic labels, server errors and raw
// Text nodes still need manual coverage review; this is not a fluency check.
const root=fileURLToPath(new URL('../src/',import.meta.url));
const files=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):entry.name.endsWith('.tsx')?[path.join(directory,entry.name)]:[]);
function add(messages,value,file,node){
 const key=value.trim();if(!key||key==='Loadgistic')return;
 const locations=messages.get(key)||new Set();locations.add(`${path.relative(root,file.fileName)}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line+1}`);messages.set(key,locations);
}
function addFixed(messages,expression,file,node){
 if(ts.isStringLiteral(expression))add(messages,expression.text,file,node);
 else if(ts.isParenthesizedExpression(expression))addFixed(messages,expression.expression,file,node);
 else if(ts.isConditionalExpression(expression)){addFixed(messages,expression.whenTrue,file,node);addFixed(messages,expression.whenFalse,file,node);}
}
export function inventoryFixedMessages(sources){
 const messages=new Map();
 for(const [name,source] of sources){
 const file=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const visit=node=>{
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='t'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))add(messages,node.arguments[0].text,file,node);
  if((ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node))&&['Title','Copy','Field','Button','AppLink','ActionLink','ConfirmationButton','WorkspaceFact','WorkspaceAction','WorkspaceTaskHeader','WorkspaceTabs','PlacePicker','LoadingBar','LoadingSpinner','Switch'].includes(node.tagName.getText(file)))for(const attr of node.attributes.properties){
   const tag=node.tagName.getText(file);
   const copyAttributes=tag==='ConfirmationButton'?['message','title','detail','cancel','confirm']:tag==='WorkspaceTaskHeader'?['backMessage']:tag==='WorkspaceAction'?['message','detail']:tag==='PlacePicker'||tag==='LoadingBar'?['label']:tag==='LoadingSpinner'||tag==='Switch'?['accessibilityLabel']:['message'];
   // Tab names are fixed copy; title/subtitle/fact values remain raw user data.
   if(tag==='WorkspaceTabs'&&ts.isJsxAttribute(attr)&&attr.name.getText(file)==='items'&&attr.initializer&&ts.isJsxExpression(attr.initializer)){
    const tabCopy=child=>{if(ts.isPropertyAssignment(child)&&child.name.getText(file)==='message'&&ts.isStringLiteral(child.initializer))add(messages,child.initializer.text,file,child);ts.forEachChild(child,tabCopy);};
    if(attr.initializer.expression)tabCopy(attr.initializer.expression);
   }
   if(ts.isJsxAttribute(attr)&&copyAttributes.includes(attr.name.getText(file))){
    const value=attr.initializer;
    if(value&&ts.isStringLiteral(value))add(messages,value.text,file,attr);
    else if(value&&ts.isJsxExpression(value)&&value.expression)addFixed(messages,value.expression,file,attr);
   }
  }
  ts.forEachChild(node,visit);
 };visit(file);
 }
 return messages;
}
export function auditTranslationSources(sources,catalogs,{strict=false}={}){
 const messages=inventoryFixedMessages(sources),locales=['am','om'];
 const missing=[...messages].flatMap(([message,locations])=>{
 const absent=locales.filter(locale=>typeof catalogs[locale][message]!=='string'||!catalogs[locale][message].trim());
 return absent.length?[{message,locales:absent,locations:[...locations]}]:[];
}).sort((a,b)=>a.message.localeCompare(b.message));
 const report={boundary:'Explicit fixed messages only; manual dynamic/remaining raw text and fluency review required',messages:messages.size,fullyCovered:messages.size-missing.length,missing:missing.length,items:missing};
 return {report,exitCode:strict&&missing.length?1:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const sources=files(root).map(name=>[name,fs.readFileSync(name,'utf8')]);
 const locales=['am','om'];
 const catalogs=Object.fromEntries(locales.map(locale=>[locale,{...JSON.parse(fs.readFileSync(new URL(`../../../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8')),...nativeMessages[locale],...gpsMessages[locale]}]));
 const {report,exitCode}=auditTranslationSources(sources,catalogs,{strict:process.argv.includes('--strict')});
 console.log(process.argv.includes('--json')?JSON.stringify(report,null,2):`${report.fullyCovered}/${report.messages} explicit native messages have both supported translations; ${report.missing} remain. Use --json for locations. Dynamic/raw text still needs manual review.`);
 process.exitCode=exitCode;
}
