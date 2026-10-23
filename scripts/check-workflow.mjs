import {createHash} from 'node:crypto';
import {chmodSync,existsSync,mkdirSync,mkdtempSync,readdirSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const actionlintVersion='1.7.12';
// Published release digests, reviewed October20. Never resolve "latest" at run time.
const archives={
  darwin_x64:['darwin_amd64','5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644'],
  darwin_arm64:['darwin_arm64','aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f'],
  linux_x64:['linux_amd64','8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8'],
  linux_arm64:['linux_arm64','325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6']
};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

export function actionlintArchive(platform=process.platform,arch=process.arch){
  const entry=archives[`${platform}_${arch}`];
  if(!entry)throw Error('WORKFLOW_TOOL_UNSUPPORTED_PLATFORM');
  return {name:`actionlint_${actionlintVersion}_${entry[0]}.tar.gz`,sha256:entry[1]};
}

export function verifyArchive(bytes,expected){
  if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('WORKFLOW_TOOL_CHECKSUM_MISMATCH');
}

export function operationalScripts(repositoryRoot){
  const files=[];
  function walk(directory){
    for(const entry of readdirSync(path.join(repositoryRoot,directory),{withFileTypes:true})){
      const file=path.join(directory,entry.name);
      if(entry.isDirectory())walk(file);
      else if(entry.isFile()&&/\.(?:mjs|cjs|js)$/.test(file))files.push(file);
    }
  }
  for(const directory of ['scripts','apps/mobile/scripts'])walk(directory);
  return files.sort();
}

export function checkScriptSyntax(file){
  // --check parses only: it must never import/execute operational code.
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8',timeout:10000,maxBuffer:65536});
  if(result.error||result.signal||result.status!==0)throw Error('WORKFLOW_SCRIPT_SYNTAX_FAILED');
}

async function main(){
  const args=process.argv.slice(2);
  if(args.length>1||(args.length===1&&args[0]!=='--setup'))throw Error('WORKFLOW_CHECK_ARGUMENTS_INVALID');
  const archive=actionlintArchive();
  const directory=path.join(root,'.local','tools','actionlint',actionlintVersion,`${process.platform}-${process.arch}`);
  const executable=path.join(directory,'actionlint');
  if(args[0]==='--setup'){
    if(existsSync(executable)){
      const version=spawnSync(executable,['--version'],{encoding:'utf8',timeout:5000});
      if(version.status===0&&version.stdout.split('\n')[0]===actionlintVersion){console.log('Pinned workflow linter already installed.');return;}
      throw Error('WORKFLOW_TOOL_CACHE_INVALID');
    }
    mkdirSync(directory,{recursive:true,mode:0o700});
    const temporary=mkdtempSync(path.join(directory,'setup-'));
    try{
      const response=await fetch(`https://github.com/rhysd/actionlint/releases/download/v${actionlintVersion}/${archive.name}`,{signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw Error('WORKFLOW_TOOL_DOWNLOAD_FAILED');
      const bytes=Buffer.from(await response.arrayBuffer());verifyArchive(bytes,archive.sha256);
      const downloaded=path.join(temporary,archive.name);writeFileSync(downloaded,bytes,{mode:0o600});
      const unpack=spawnSync('tar',['-xzf',downloaded,'-C',temporary,'actionlint'],{encoding:'utf8',timeout:10000});
      if(unpack.error||unpack.signal||unpack.status!==0)throw Error('WORKFLOW_TOOL_EXTRACTION_FAILED');
      chmodSync(path.join(temporary,'actionlint'),0o700);renameSync(path.join(temporary,'actionlint'),executable);
      console.log(`Installed checksum-verified actionlint ${actionlintVersion} in the project cache.`);
    }finally{rmSync(temporary,{recursive:true,force:true});}
    return;
  }
  if(!existsSync(executable))throw Error('WORKFLOW_TOOL_MISSING: run npm run tools:workflow:setup once');
  const started=performance.now();
  const version=spawnSync(executable,['--version'],{encoding:'utf8',timeout:5000});
  if(version.status!==0||version.stdout.split('\n')[0]!==actionlintVersion)throw Error('WORKFLOW_TOOL_VERSION_MISMATCH');
  const lint=spawnSync(executable,['-oneline'],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:262144});
  if(lint.stdout)process.stdout.write(lint.stdout);
  if(lint.error||lint.signal||lint.status!==0)throw Error('WORKFLOW_ACTIONLINT_FAILED');
  const shellcheck=spawnSync('shellcheck',['--version'],{encoding:'utf8',timeout:5000});
  const files=operationalScripts(root);
  for(const file of files){
    try{checkScriptSyntax(path.join(root,file));}
    catch{throw Error(`WORKFLOW_SCRIPT_SYNTAX_FAILED: ${file}`);}
  }
  console.log(`Workflow static checks passed: ${files.length} operational scripts parsed, actionlint ${actionlintVersion}, ${(performance.now()-started).toFixed(0)}ms; ShellCheck ${shellcheck.status===0?'available':'not installed (shell analysis not verified)'}.`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
