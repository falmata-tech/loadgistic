import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';

const require=createRequire(import.meta.url);
function component(file,dependencies){
  const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}
  }).outputText;
  const exports={};
  new Function('require','exports',source)(name=>Object.hasOwn(dependencies,name)?dependencies[name]:require(name),exports);
  return exports;
}
const loading=component('../src/components/loading-state.tsx',{'./localization':{
  Text:({message})=>message,
  Localized:({as,copy,...props})=>React.createElement(as,props)
}});
const render=element=>renderToStaticMarkup(element);

test('pending map and record routes reserve a neutral surface before the identity shell resolves',()=>{
  for(const pathname of['/','/app/home','/app/home/market','/app/fleet','/admin','/support',null]){
    const {RouteLoading}=component('../src/components/route-loading.tsx',{
      'next/navigation':{usePathname:()=>pathname},'./loading-state':loading
    });
    const html=render(React.createElement(RouteLoading));
    const map=['/','/app/home','/app/home/market'].includes(pathname);
    assert.match(html,new RegExp(`data-loading-surface="${map?'map':'records'}"`));
    assert.equal(html.includes('skeleton-map-canvas'),map);
    assert.equal((html.match(/role="status"/g)||[]).length,1);
    assert.match(html,/aria-busy="true"/);
    assert.doesNotMatch(html,/<(?:a|button|input|select)\b|public-header|account-name/,
      'a loading surface must not invent an identity, available controls or public navigation');
  }
});

test('surface decoration is hidden and every pending task has one concise status',()=>{
  for(const kind of['map','records','form','chat']){
    const html=render(React.createElement(loading.SurfaceSkeleton,{kind,label:'Loading workspace'}));
    assert.equal((html.match(/role="status"/g)||[]).length,1);
    assert.match(html,/<span class="sr-only" role="status">Loading workspace<\/span>/);
    assert.match(html,/<div class="skeleton-decoration" aria-hidden="true">/);
    assert.doesNotMatch(html,/aria-valuenow|%|<button/);
  }
});
