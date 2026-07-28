import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const trackedFiles=['next-env.d.ts','tsconfig.json'];
const originals=new Map(trackedFiles.map(file=>[file,readFileSync(path.join(root,file),'utf8')]));
const nextCli=path.join(root,'node_modules','next','dist','bin','next');
const child=spawn(process.execPath,[nextCli,'build',...process.argv.slice(2)],{
  cwd:root,
  env:process.env,
  stdio:'inherit'
});

let restored=false;
function restoreGeneratedMetadata(){
  if(restored)return;
  restored=true;
  for(const [file,content] of originals)writeFileSync(path.join(root,file),content);
}

for(const signal of ['SIGINT','SIGTERM']){
  process.once(signal,()=>{
    child.kill(signal);
    restoreGeneratedMetadata();
  });
}

child.once('error',error=>{
  restoreGeneratedMetadata();
  console.error('Unable to start the Next.js build:',error.message);
  process.exitCode=1;
});

child.once('exit',(code,signal)=>{
  restoreGeneratedMetadata();
  if(signal)console.error(`Next.js build stopped by ${signal}.`);
  process.exitCode=code ?? 1;
});

process.once('exit',restoreGeneratedMetadata);
