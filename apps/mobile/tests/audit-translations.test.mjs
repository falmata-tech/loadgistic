import test from 'node:test';
import assert from 'node:assert/strict';
import {auditTranslationSources} from '../scripts/audit-translations.mjs';

const source=`
<>
 <LoadingSpinner accessibilityLabel="Loading the fleet" />
 <Switch accessibilityLabel={ready ? 'Enable sharing' : 'Disable sharing'} />
 <LoadingSpinner accessibilityLabel={shipment.name} />
 <Switch accessibilityLabel={userLabel} />
 <Text>{shipment.name}</Text>
</>`;
const sources=[['fixture.tsx',source]];
const translated={
 am:{'Loading the fleet':'ጭነት መኪኖች እየተጫኑ ነው','Enable sharing':'ማጋራትን አብራ','Disable sharing':'ማጋራትን አጥፋ'},
 om:{'Loading the fleet':'Konkolaattota feʼumsaa feʼaa jira','Enable sharing':'Qooduu bani','Disable sharing':'Qooduu dhaamsi'},
};

test('strict native translation audit inventories fixed spinner and switch labels, but excludes dynamic content',()=>{
 const complete=auditTranslationSources(sources,translated,{strict:true});
 assert.equal(complete.exitCode,0);
 assert.equal(complete.report.messages,3);
 assert.deepEqual(complete.report.items,[]);

 const missing=auditTranslationSources(sources,{
  am:{...translated.am,'Loading the fleet':''},
  om:{...translated.om,'Enable sharing':undefined,'Disable sharing':''},
 },{strict:true});
 assert.equal(missing.exitCode,1);
 assert.deepEqual(missing.report.items.map(({message,locales})=>[message,locales]),[
  ['Disable sharing',['om']],
  ['Enable sharing',['om']],
  ['Loading the fleet',['am']],
 ]);
 assert.ok(missing.report.items.every(({locations})=>locations.some(location=>location.includes('fixture.tsx:'))));
 assert.equal(auditTranslationSources(sources,{am:{},om:{}},{strict:false}).exitCode,0,'report-only mode remains nonblocking');
});
