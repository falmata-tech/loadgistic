import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const query=require('query-string');

test('installed Router query parser preserves ordinary URL semantics',()=>{
 assert.deepEqual({...query.parse('city=Addis+Ababa&name=%E1%8A%A0%E1%8B%B2%E1%88%B5&ids=one&ids=two&empty=&flag')},{city:'Addis Ababa',empty:'',flag:null,ids:['one','two'],name:'አዲስ'});
 const input={city:'Dire Dawa',q:'café & tea',ids:['one','two']};
 assert.deepEqual({...query.parse(query.stringify(input))},input);
});
test('installed URI decoder is the patched version and malformed input is bounded',()=>{
 const decoder=JSON.parse(readFileSync(path.join(path.dirname(require.resolve('decode-uri-component')),'package.json'),'utf8'));
 assert.equal(decoder.version,'0.5.0');
 const child=spawnSync(process.execPath,['-e',"const query=require('query-string');const start=Date.now();const result=query.parse('q='+('%E0%A4'.repeat(128)));if(typeof result.q!=='string')process.exit(2);console.log(Date.now()-start);"],{cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8',timeout:4000});
 assert.equal(child.error,undefined,'Malformed URLs must not exhaust parser resources');
 assert.equal(child.status,0,child.stderr);assert.ok(Number(child.stdout.trim())<3000);
});
