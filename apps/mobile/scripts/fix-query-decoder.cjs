// Temporary compatibility adapter for query-string 7.1.3 + patched URI decoder.
// Fail on upstream drift. Remove when Router adopts a compatible patched consumer.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
if(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).name!=='@loadgistic/mobile')throw Error('LOADGISTIC_MOBILE_REQUIRED');
const consumer=path.join(root,'node_modules/query-string');
if(JSON.parse(fs.readFileSync(path.join(consumer,'package.json'))).version!=='7.1.3')throw Error('REVIEW_NEW_QUERY_STRING_VERSION');
const target=path.join(consumer,'index.js'),original=fs.readFileSync(target,'utf8');
const before="const decodeComponent = require('decode-uri-component');";
const after="const decodeComponent = require('decode-uri-component').default;";
const reverted=original.replace(after,before);
if(createHash('sha256').update(reverted).digest('hex')!=='caa3f2c8b45dfe1e91db22ae10743af68de8d96f26515132bb52485ec0f037fa')throw Error('REVIEW_QUERY_PARSER_SOURCE_DRIFT');
if(!original.includes(after))fs.writeFileSync(target,original.replace(before,after));
console.log('Loadgistic mobile: verified URI decoder compatibility adapter.');
