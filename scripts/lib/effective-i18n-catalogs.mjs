import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Audit/test access to the same trusted, data-only overlays used by catalogs.ts.
// Transpiling them keeps the audit's ordinary Node22 CLI independent of a
// caller's experimental strip-types flag. No caller-controlled module is loaded.
export async function loadEffectiveWebCatalogs(){
  const overlays=[];
  for(const [file,name] of [['gps-messages.ts','gpsMessages'],
    ['tracking-sharing-messages.ts','trackingSharingMessages'],
    ['business-workspace-messages.ts','businessWorkspaceMessages']]){
    const source=readFileSync(new URL(`../../src/lib/i18n/${file}`,import.meta.url),'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
    overlays.push((await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`))[name]);
  }
  return Object.fromEntries(['am','om'].map(locale=>[locale,Object.assign(
    JSON.parse(readFileSync(new URL(`../../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8')),
    ...overlays.map(messages=>messages[locale]))]));
}
